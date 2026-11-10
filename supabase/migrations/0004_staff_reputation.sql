-- ProjectFM: staff reputation as its own field
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

alter table public.staff add column reputation text;

-- Move "Reputation: X" out of notes for staff entered before this field existed
update public.staff
set reputation = substring(notes from 'Reputation: ([A-Za-z]+)'),
    notes = nullif(
      trim(both ' ·' from regexp_replace(notes, '\s*·?\s*Reputation: [A-Za-z]+', '')),
      ''
    )
where notes ~ 'Reputation: [A-Za-z]+';
