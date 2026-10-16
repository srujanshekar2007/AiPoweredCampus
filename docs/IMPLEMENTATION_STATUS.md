# Implementation status

## Implemented

- Google OAuth entry and authenticated callback, pending profile enrollment, and manual administrator approval for student/worker roles.
- Workspace authorization based on verified campus profiles or pre-existing trusted `app_metadata.role` claims.
- Database-backed issue reporting, staff assignment by verified worker account, workflow updates, and role-aware RLS migration.
- Staff-only sensor feed and authenticated device ingestion. Missing/stale readings do not get fabricated.
- Measured sustainability summaries for today, week and month, with same-elapsed-window comparison and explicit missing-data states.
- Local EcoTwin website-help chatbot with fixed FAQ responses; it reads no campus records and makes no external requests. Optional Gemini integration remains only for issue-photo analysis.
- Data-backed profile and activity views. The Digital Twin now supports campus → building → floor → room exploration, procedural room/floor geometry, and linked `campus_issues` markers; it does not create or mutate issue records from the Twin view.

## Database migrations

Run `supabase/schema.sql`, `supabase/audit-log.sql`, `supabase/secure-onboarding.sql`, and `supabase/digital-twin.sql` in that order. The Digital Twin migration adds buildings, floors and rooms with verified-campus read access and verified-admin write access; it preserves table data. If the standalone demo schema was previously applied, the migration disables its unsafe self-editable `profiles` and duplicate `issues` API policies. The app uses `campus_profiles` and `campus_issues`. Existing rows are preserved. Sensor aggregate views require `SUPABASE_SERVICE_ROLE_KEY`; raw sensor access remains restricted to verified staff at the application layer and RLS.

## Environment-dependent validation

The checked-in example file lists required environment variable names without values. Live Google OAuth, actual Supabase policies, optional Gemini photo analysis and device submissions must be exercised using the campus project's own credentials and hardware. Do not use synthetic readings to represent campus measurements.
