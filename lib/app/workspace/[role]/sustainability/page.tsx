import { createClient } from "@/lib/supabase/server";

type Equipment = {
  id: string;
  building_name: string;
  room_number: string;
  room_name: string;
  component_name: string;
  quantity: number;
  wattage: number | string;
  notes: string | null;
};

type TimetableEntry = {
  building_name: string;
  room_number: string;
  room_name: string;
  class_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type SensorReading = {
  id: string;
  device_id: string;
  metric: string;
  value: number | string;
  unit: string;
  location: string;
  recorded_at: string;
  reading_type: string;
};

type RoomReport = {
  key: string;
  building: string;
  roomNumber: string;
  roomName: string;
  equipment: Equipment[];
  scheduledHoursPerWeek: number;
  estimatedKwhPerWeek: number;
  installedWatts: number;
  topComponent: Equipment | null;
};

const numberFormat = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function hoursBetween(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  return Math.max(
    0,
    endHour + endMinute / 60 - (startHour + startMinute / 60),
  );
}

function getRoomKey(building: string, room: string) {
  return `${building.trim().toLowerCase()}::${room.trim().toLowerCase()}`;
}

function getExpectedHours(
  building: string,
  roomNumber: string,
  timetable: TimetableEntry[],
) {
  const matchingClasses = timetable.filter(
    (entry) =>
      getRoomKey(entry.building_name, entry.room_number) ===
      getRoomKey(building, roomNumber),
  );

  // Group by weekday so a room used on five different days is not treated
  // as if its weekly timetable were a single day's timetable.
  const hoursByDay = new Map<number, number>();

  for (const entry of matchingClasses) {
    const duration = hoursBetween(entry.start_time, entry.end_time);
    hoursByDay.set(
      entry.day_of_week,
      (hoursByDay.get(entry.day_of_week) ?? 0) + duration,
    );
  }

  // This simple sum assumes timetable periods do not overlap.
  // Overlapping periods should be merged before production reporting.
  return {
    weekly: Array.from(hoursByDay.values()).reduce(
      (sum, hours) => sum + hours,
      0,
    ),
    classes: matchingClasses,
  };
}

export default async function SustainabilityPage() {
  let equipment: Equipment[] = [];
  let timetable: TimetableEntry[] = [];
  let readings: SensorReading[] = [];
  let dataErrors: string[] = [];

  try {
    const supabase = await createClient();

    const [
      { data: equipmentData, error: equipmentError },
      { data: timetableData, error: timetableError },
      { data: readingData, error: readingsError },
    ] = await Promise.all([
      supabase
        .from("energy_equipment")
        .select("*")
        .order("building_name")
        .order("room_number"),
      supabase
        .from("campus_timetable")
        .select("*")
        .order("day_of_week")
        .order("start_time"),
      supabase
        .from("sensor_readings")
        .select("*")
        .eq("metric", "electricity")
        .order("recorded_at", { ascending: false })
        .limit(100),
    ]);

    if (equipmentError) dataErrors.push(`Equipment: ${equipmentError.message}`);
    else equipment = (equipmentData ?? []) as Equipment[];

    if (timetableError) dataErrors.push(`Timetable: ${timetableError.message}`);
    else timetable = (timetableData ?? []) as TimetableEntry[];

    if (readingsError) dataErrors.push(`Sensors: ${readingsError.message}`);
    else readings = (readingData ?? []) as SensorReading[];
  } catch {
    dataErrors.push(
      "Supabase could not be reached. Check your server configuration and authentication.",
    );
  }

  const roomMap = new Map<string, RoomReport>();

  for (const item of equipment) {
    const key = getRoomKey(item.building_name, item.room_number);

    if (!roomMap.has(key)) {
      const schedule = getExpectedHours(
        item.building_name,
        item.room_number,
        timetable,
      );

      roomMap.set(key, {
        key,
        building: item.building_name,
        roomNumber: item.room_number,
        roomName: item.room_name,
        equipment: [],
        scheduledHoursPerWeek: schedule.weekly,
        estimatedKwhPerWeek: 0,
        installedWatts: 0,
        topComponent: null,
      });
    }

    const room = roomMap.get(key)!;
    const quantity = Number(item.quantity);
    const wattage = Number(item.wattage);
    const totalWatts = quantity * wattage;

    room.equipment.push(item);
    room.installedWatts += totalWatts;

    // This is an estimate based on equipment running during scheduled
    // room hours. It is not a measured electricity meter reading.
    room.estimatedKwhPerWeek +=
      (totalWatts * room.scheduledHoursPerWeek) / 1000;

    if (
      !room.topComponent ||
      quantity * wattage >
        Number(room.topComponent.quantity) *
          Number(room.topComponent.wattage)
    ) {
      room.topComponent = item;
    }
  }

  const rooms = Array.from(roomMap.values()).sort(
    (a, b) => b.estimatedKwhPerWeek - a.estimatedKwhPerWeek,
  );

  const buildingMap = new Map<
    string,
    { name: string; kwh: number; roomCount: number }
  >();

  for (const room of rooms) {
    const building = buildingMap.get(room.building) ?? {
      name: room.building,
      kwh: 0,
      roomCount: 0,
    };

    building.kwh += room.estimatedKwhPerWeek;
    building.roomCount += 1;
    buildingMap.set(room.building, building);
  }

  const buildings = Array.from(buildingMap.values()).sort(
    (a, b) => b.kwh - a.kwh,
  );

  const estimatedWeeklyKwh = rooms.reduce(
    (sum, room) => sum + room.estimatedKwhPerWeek,
    0,
  );

  const totalInstalledWatts = equipment.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.wattage),
    0,
  );

  const hasEquipment = equipment.length > 0;
  const hasTimetable = timetable.length > 0;

  return (
    <main className="min-h-screen bg-[#f3f7f4] p-4 text-[#20332b] md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              EcoTwin · Campus operations
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Electricity Sustainability Report
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Explore energy estimates by building, room, equipment and
              college timetable. Measured sensor readings are shown separately
              from calculated estimates.
            </p>
          </div>

          <a
            href="/workspace/student"
            className="inline-flex w-fit items-center rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            ← Back to dashboard
          </a>
        </header>

        {dataErrors.length > 0 && (
          <section
            role="status"
            className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <h2 className="font-bold">Some data could not be loaded</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {dataErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            <p className="mt-2">
              Check the table names, permissions and Supabase server logs.
              Missing readings are not treated as zero consumption.
            </p>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Estimated weekly energy"
            value={`${formatNumber(estimatedWeeklyKwh)} kWh`}
            detail="Calculated from wattage × scheduled hours"
          />
          <MetricCard
            label="Installed equipment load"
            value={`${formatNumber(totalInstalledWatts / 1000)} kW`}
            detail="Sum of listed equipment ratings"
          />
          <MetricCard
            label="Buildings inventoried"
            value={String(buildings.length)}
            detail="Buildings with equipment records"
          />
          <MetricCard
            label="Latest electricity readings"
            value={String(readings.length)}
            detail="Latest 100 readings returned by Supabase"
          />
        </section>

        {!hasEquipment && (
          <section className="rounded-2xl border border-dashed border-emerald-300 bg-white p-6">
            <h2 className="text-lg font-bold">No equipment inventory yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Add building names, room numbers, appliance quantities and
              wattage to the energy_equipment table. Until then, the report
              cannot calculate room-level estimates.
            </p>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold">Building comparison</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ranked by estimated weekly energy, not measured meter totals.
              </p>
            </div>

            {buildings.length === 0 ? (
              <EmptyState message="Building estimates will appear after you add equipment inventory." />
            ) : (
              <div className="space-y-5">
                {buildings.map((building, index) => {
                  const max = buildings[0]?.kwh || 1;
                  const percent = (building.kwh / max) * 100;

                  return (
                    <div key={building.name}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {index + 1}. {building.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {building.roomCount} inventoried rooms
                          </p>
                        </div>
                        <p className="whitespace-nowrap text-sm font-bold">
                          {formatNumber(building.kwh)} kWh/week
                        </p>
                      </div>
                      <div
                        className="h-3 overflow-hidden rounded-full bg-emerald-50"
                        role="img"
                        aria-label={`${building.name}: ${formatNumber(building.kwh)} estimated kWh per week`}
                      >
                        <div
                          className="h-full rounded-full bg-emerald-700"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Potential savings opportunities</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recommendations based on inventory and schedule coverage.
            </p>

            {!hasEquipment ? (
              <EmptyState message="Add equipment data to generate room-specific recommendations." />
            ) : (
              <div className="mt-5 space-y-3">
                {!hasTimetable && (
                  <Recommendation
                    title="Timetable data is missing"
                    description="Add the weekly class schedule for each room. Without it, the system cannot estimate scheduled operating hours or compare equipment use with class times."
                    level="Action needed"
                  />
                )}

                {rooms.slice(0, 4).map((room) => {
                  const top = room.topComponent;
                  if (!top) return null;

                  const watts =
                    Number(top.quantity) * Number(top.wattage);

                  return (
                    <Recommendation
                      key={room.key}
                      title={`${room.building} · Room ${room.roomNumber}`}
                      description={`${top.component_name} has the highest combined rated load among the listed components in this room (${formatNumber(watts)} W). Verify whether equipment is switched off when the room is not in use. This is a potential savings opportunity, not proof of waste.`}
                      level="Review"
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              <strong>Important:</strong> A timetable tells us when a room is
              scheduled for use. It does not prove that a fan, light or computer
              is switched on. Confirm possible waste with meter readings,
              device-state sensors or a staff inspection before marking it as
              detected waste.
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Room and equipment breakdown</h2>
            <p className="mt-1 text-sm text-slate-500">
              Estimated energy assumes every listed component runs for the
              room's scheduled hours. Component wattage is the combined load
              for its quantity.
            </p>
          </div>

          {rooms.length === 0 ? (
            <EmptyState message="Room-level results will appear when equipment inventory is available." />
          ) : (
            <div className="space-y-5">
              {rooms.map((room) => (
                <article
                  key={room.key}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <div className="flex flex-col justify-between gap-3 bg-slate-50 p-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-bold">
                        {room.building} · Room {room.roomNumber}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {room.roomName}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-lg font-bold text-emerald-800">
                        {formatNumber(room.estimatedKwhPerWeek)} kWh/week
                      </p>
                      <p className="text-xs text-slate-500">
                        Estimated · {formatNumber(room.scheduledHoursPerWeek)}{" "}
                        scheduled hours/week
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Component</th>
                          <th className="px-4 py-3">Quantity</th>
                          <th className="px-4 py-3">Wattage each</th>
                          <th className="px-4 py-3">Combined load</th>
                          <th className="px-4 py-3">Est. kWh/week</th>
                        </tr>
                      </thead>
                      <tbody>
                        {room.equipment.map((item) => {
                          const quantity = Number(item.quantity);
                          const wattage = Number(item.wattage);
                          const watts = quantity * wattage;
                          const energy =
                            (watts * room.scheduledHoursPerWeek) / 1000;

                          return (
                            <tr
                              key={item.id}
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-3 font-medium">
                                {item.component_name}
                              </td>
                              <td className="px-4 py-3">{quantity}</td>
                              <td className="px-4 py-3">
                                {formatNumber(wattage)} W
                              </td>
                              <td className="px-4 py-3">
                                {formatNumber(watts)} W
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {formatNumber(energy)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-slate-100 p-4">
                    <p className="text-sm font-semibold">Recommended checks</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      <li>
                        Confirm equipment ratings against the labels or
                        manufacturer specifications.
                      </li>
                      <li>
                        Compare the room timetable with actual usage and
                        shutdown practices.
                      </li>
                      <li>
                        If a room-level meter is installed, compare its
                        measured energy with this estimate.
                      </li>
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Latest electricity sensor readings</h2>
          <p className="mt-1 text-sm text-slate-500">
            These are recent records from sensor_readings. The unit and
            reading type determine whether a value represents power, energy,
            a level, or a counter.
          </p>

          {readings.length === 0 ? (
            <EmptyState message="No electricity readings are available. The report still shows equipment-based estimates when inventory data exists." />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Location</th>
                    <th className="px-3 py-3">Device</th>
                    <th className="px-3 py-3">Reading</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((reading) => (
                    <tr key={reading.id} className="border-t border-slate-100">
                      <td className="px-3 py-3">{reading.location}</td>
                      <td className="px-3 py-3">{reading.device_id}</td>
                      <td className="px-3 py-3 font-semibold">
                        {formatNumber(Number(reading.value))} {reading.unit}
                      </td>
                      <td className="px-3 py-3">{reading.reading_type}</td>
                      <td className="px-3 py-3">
                        {new Date(reading.recorded_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="rounded-xl bg-[#214d3f] p-5 text-sm leading-6 text-white">
          <h2 className="font-bold">How this report calculates energy</h2>
          <p className="mt-2 text-emerald-50">
            Estimated kWh = quantity × rated watts × scheduled operating hours
            ÷ 1,000. This estimates usage during scheduled room hours; it does
            not account for device power states, variable loads, overlapping
            classes or unscheduled activities. Use calibrated energy meters
            for actual consumption.
          </p>
        </footer>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
      {message}
    </div>
  );
}

function Recommendation({
  title,
  description,
  level,
}: {
  title: string;
  description: string;
  level: string;
}) {
  return (
    <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-amber-950">{title}</h3>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-amber-800">
          {level}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-amber-950/80">
        {description}
      </p>
    </article>
  );
}