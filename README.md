# EcoTwin AI — Sustainable Campus

EcoTwin is a Next.js campus operations application with verified account onboarding, issue reporting and assignment, campus sensor monitoring, a digital twin view, and sustainability summaries based on submitted device readings. Campus APIs require Supabase authentication. The Digital Twin includes clearly labeled illustrative starter geometry; campus issue and sensor records are never seeded by the app.

## Run locally

Use Node.js 20.9 or later. From this folder (the one containing `package.json`):

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Sign-in and campus data require the Supabase setup below. Without credentials the app shows a configuration message; it does not create a local authenticated session.

## Supabase setup

1. Create a Supabase project and configure Google OAuth in Supabase Auth, including the local callback URL `http://localhost:3000/auth/callback` and your deployment callback URL.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
3. In order, run `supabase/schema.sql`, `supabase/audit-log.sql`, `supabase/secure-onboarding.sql`, then `supabase/digital-twin.sql` in the Supabase SQL editor. The last migration adds verified-user campus geometry and a starter building/floor/room layout. It keeps existing Supabase tables and rows; if the standalone demo schema was previously applied, it also replaces its permissive geometry policies and disables its unused self-editable `profiles` and duplicate `issues` API policies. The app continues using `campus_profiles` and `campus_issues`.
4. Create the first campus administrator through a trusted Supabase server-side process by setting `app_metadata.role=admin`. Do not set roles in editable user metadata or from the browser. Administrators can then review pending profiles and approve student or worker roles.
5. Restart `npm run dev` after changing environment variables.

New users sign in with Google, submit their full name, phone number and campus ID, and remain pending until an administrator reviews the request. Only verified profiles can enter a workspace. Configure trusted campus domains in Supabase Auth if institutional email restrictions are required.

## Sensor ingestion

Set a strong server-only `SENSOR_INGEST_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Keep both private. Submit readings to `POST /api/sensors` with `Authorization: Bearer <token>` and JSON such as:

```json
{"deviceId":"meter-east-01","metric":"electricity","readingType":"interval_total","value":3.2,"unit":"kWh","location":"East building"}
```

Allowed metrics are `dustbin`, `water_level`, `electricity`, `water`, and `waste_diverted`; accepted units are validated by metric. Device timestamps are assigned by the server on receipt. The sensor feed exposes exactly Dustbin Sensor, Water Level Sensor, and Electricity Sensor. A device is CONNECTED only when its latest reading is within 15 minutes, otherwise STALE; absent readings show NOT CONNECTED.

## AI configuration

The EcoTwin Help chatbot uses a small local website FAQ. It does not call Gemini, read campus records, or send prompts to a third party. Supabase sign-in and database access remain in place for the campus application.

`GEMINI_API_KEY` is only used by the separate optional issue-photo analysis endpoint; it is server-only. `GEMINI_MODEL` defaults to `gemini-3.8-flash`. Photo suggestions are advisory and users must review them. Campus APIs return structured JSON errors and do not reveal provider keys.

## Data and access

- Student issue access is limited to their own reports. Workers see and update assigned work. Administrators manage campuswide records.
- Students cannot access raw sensor readings or the sensor feed. Sustainability endpoints return aggregate totals only and require a verified campus account.
- Sustainability periods are Today, This week and This month in `Asia/Kolkata`. Totals use interval readings with matching metrics and units; comparison uses the matching elapsed window in the previous period. Missing readings remain unavailable.
- Existing issue/profile rows are preserved by the migrations. The app reads user-submitted issues and does not display legacy rows marked `demo`. The starter Twin geometry is illustrative and should be replaced with surveyed dimensions before operational use.
- `data/campus-store.json`, if present from an earlier local version, is ignored and never read by the application.

## Checks

```sh
npm run test
npx tsc --noEmit
npm run lint
npm run build
```

Google OAuth, administrator approval, optional photo-analysis Gemini requests, sensor hardware, and production RLS behavior need to be validated with the corresponding real credentials and campus devices. These are not simulated by the application.
