-- Geoclick — Supabase schema for optional cross-device sync (Iteration 8+).
--
-- Multi-user mirror of the local single-user schema that already ships in
-- desktop/src-tauri/src/lib.rs's migrations() (Tauri/SQLite) and
-- app/src/lib/capacitorProgressRepository.ts (Capacitor/SQLite): same
-- columns, plus a user_id and Postgres row-level security in place of "one
-- file per device". See app/src/lib/supabaseProgressRepository.ts for the
-- client code that reads/writes these tables, and DECISIONS.md's
-- "Cross-device sync (Supabase)" entry for the sync/conflict-resolution
-- reasoning.
--
-- How to run this: paste this whole file into your Supabase project's
-- SQL Editor (dashboard -> SQL Editor -> New query) and run it once, after
-- creating the project. See ONBOARDING.md's "Enabling cross-device sync
-- (Supabase)" section for the full manual setup walkthrough. Safe to
-- re-run - every statement is idempotent (IF NOT EXISTS / DROP POLICY IF
-- EXISTS then CREATE).

create table if not exists card_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  map_id text not null,
  target_id text not null,
  ease_factor double precision not null,
  interval integer not null,
  repetitions integer not null,
  due_date text not null,
  last_reviewed_at text not null,
  primary key (user_id, map_id, target_id)
);

create table if not exists session_summaries (
  user_id uuid not null references auth.users (id) on delete cascade,
  map_id text not null,
  total integer not null,
  perfect integer not null,
  total_errors integer not null,
  completed_at text not null,
  primary key (user_id, map_id)
);

-- Row-level security: a signed-in user can only ever read/write their own
-- rows. Hard requirement for a real multi-tenant table, not optional
-- polish - without this, Supabase's anon-key client (which every browser
-- holds, by design) could read or overwrite any other user's progress.
alter table card_states enable row level security;
alter table session_summaries enable row level security;

drop policy if exists "card_states: select own rows" on card_states;
create policy "card_states: select own rows"
  on card_states for select
  using (auth.uid() = user_id);

drop policy if exists "card_states: insert own rows" on card_states;
create policy "card_states: insert own rows"
  on card_states for insert
  with check (auth.uid() = user_id);

drop policy if exists "card_states: update own rows" on card_states;
create policy "card_states: update own rows"
  on card_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "card_states: delete own rows" on card_states;
create policy "card_states: delete own rows"
  on card_states for delete
  using (auth.uid() = user_id);

drop policy if exists "session_summaries: select own rows" on session_summaries;
create policy "session_summaries: select own rows"
  on session_summaries for select
  using (auth.uid() = user_id);

drop policy if exists "session_summaries: insert own rows" on session_summaries;
create policy "session_summaries: insert own rows"
  on session_summaries for insert
  with check (auth.uid() = user_id);

drop policy if exists "session_summaries: update own rows" on session_summaries;
create policy "session_summaries: update own rows"
  on session_summaries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "session_summaries: delete own rows" on session_summaries;
create policy "session_summaries: delete own rows"
  on session_summaries for delete
  using (auth.uid() = user_id);
