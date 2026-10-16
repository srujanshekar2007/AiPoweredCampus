-- Replace only campus geometry rows with the requested numbered layout.
-- Auth, campus_profiles, campus_issues, issue history, and their policies remain untouched.
-- Run this in Supabase SQL Editor after supabase/digital-twin.sql is installed.

begin;

delete from public.rooms;
delete from public.floors;
delete from public.buildings;

insert into public.buildings (id, name, position_x, position_z, size_x, size_y, size_z, floor_count)
values
  ('10000000-0000-4000-8000-000000000001', '1', 0, -18, 10, 12, 10, 4),
  ('10000000-0000-4000-8000-000000000002', '2', 18, 0, 10, 12, 10, 4),
  ('10000000-0000-4000-8000-000000000003', '3', 0, 18, 10, 12, 10, 4),
  ('10000000-0000-4000-8000-000000000004', '4', -18, 0, 10, 12, 10, 4);

insert into public.floors (building_id, floor_number)
select b.id, gs.floor_number
from public.buildings b
cross join generate_series(1, 4) as gs(floor_number);

insert into public.rooms (floor_id, name, room_type)
select f.id,
       'Room ' || f.floor_number::text || lpad(gs.room_number::text, 2, '0'),
       case gs.room_number
         when 1 then 'classroom'
         when 2 then 'laboratory'
         when 3 then 'study'
         else 'general'
       end
from public.floors f
cross join generate_series(1, 4) as gs(room_number);

commit;
