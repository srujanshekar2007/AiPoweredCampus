# Campus data

No synthetic sensor readings are included. Sensor data is accepted through the authenticated server ingestion endpoint and stored in Supabase with server receipt timestamps. The ignored `campus-store.json` path may remain on an existing developer machine from an earlier version, but the application no longer reads it.

## Synthetic campus energy demonstration

`synthetic-campus.json` is generated reproducibly from `lib/energy-campus.ts` using seed `20261016`. It contains four buildings, 24 floors, the linked room inventory, equipment, a timetable, and synthetic sessions used for occupancy estimates. All of these are DEMO data, not measured campus telemetry. Run `npm run data:generate` to regenerate the JSON and the idempotent Supabase seed at `supabase/synthetic-campus-energy.sql`.

To persist the synthetic layout and equipment in the existing Supabase project, first apply the existing Digital Twin and secure-onboarding SQL if they are not already installed, then run `supabase/synthetic-campus-energy.sql` in that project's SQL editor. It adds metadata and energy tables with read-only verified-campus RLS policies; it does not delete issue, profile, building, floor, or room rows. Supabase records are not substituted for authenticated measured sensor readings on the resource dashboard.
