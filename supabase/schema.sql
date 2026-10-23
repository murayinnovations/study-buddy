-- Curriculum AI database. Run in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Every statement is safe to run again, so after a change just run the whole file.
--
-- People sign in with Supabase Auth (an emailed link), but the browser still never reads
-- tables directly: every read and write goes through the app's /api routes, which check
-- the signed-in member's role and use the secret key. Row-level security is enabled on
-- every table with no policies, which blocks the publishable key entirely.

-- Who may sign in, and as what. Add people with scripts/add-member.mjs.
create table if not exists members (
  email       text primary key check (email = lower(email)),
  role        text not null check (role in ('student', 'lecturer', 'hod')),
  name        text not null,
  student_id  text unique,                 -- students only: their student number
  subtitle    text,                        -- shown under the name, e.g. 'Year 2 · BCom · SBS'
  sample_data boolean not null default false, -- students only: start from sample mastery (for demos)
  demo_group  text,                           -- members sharing a group can switch between each other's views
  created_at  timestamptz not null default now(),
  check ((role = 'student') = (student_id is not null))
);

-- Added after the table above already existed in some projects; harmless if the column is already there.
alter table members add column if not exists demo_group text;


create table if not exists mastery (
  student_id   text not null,
  course       text not null,
  topic        text not null,
  position     int  not null,             -- display order within the course
  score        int  not null check (score between 0 and 100),
  sessions     int  not null default 0,
  week         int,                        -- week the topic is taught
  practised_at timestamptz,                -- last practice; null if never
  primary key (student_id, course, topic)
);

create table if not exists practice_log (
  id         bigint generated always as identity primary key,
  student_id text not null,
  course     text not null,
  topic      text not null,
  correct    boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists chats (
  student_id text not null,
  course     text not null,
  messages   jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (student_id, course)
);

create table if not exists questions (
  id              text primary key,
  course          text not null,
  student_id      text not null,
  topic           text not null,
  urgency         text not null check (urgency in ('High', 'Medium', 'Low')),
  question        text not null,
  context         text not null default '',
  asked_label     text,                    -- fixed label for seeded questions, e.g. '2 hours ago'
  created_at      timestamptz not null default now(),
  reply           text,
  replied_at      timestamptz,
  saved_to_course boolean not null default false,
  seen_by_student boolean not null default false
);

create table if not exists misconceptions (
  id         text primary key,
  course     text not null,
  topic      text not null,
  note       text not null,
  at_label   text,
  created_at timestamptz not null default now()
);

create table if not exists materials (
  id         text primary key,
  course     text not null,
  title      text not null,
  type       text not null,
  topics     text[] not null default '{}',
  body       text not null,
  status     text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id         text primary key,
  course     text not null,
  goal       text not null,
  week       text not null,
  mapped     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists practice_approvals (
  course      text not null,
  practice_id int  not null,
  primary key (course, practice_id)
);

create table if not exists check_ins (
  course     text not null,
  student_id text not null,
  created_at timestamptz not null default now(),
  primary key (course, student_id)
);

create table if not exists briefs (
  course       text primary key,
  items        jsonb not null,
  generated_at timestamptz not null,
  signature    text not null
);

create index if not exists questions_course_created on questions (course, created_at desc);
create index if not exists misconceptions_course_created on misconceptions (course, created_at desc);
create index if not exists practice_log_student on practice_log (student_id, course);

alter table members            enable row level security;
alter table mastery            enable row level security;
alter table practice_log       enable row level security;
alter table chats              enable row level security;
alter table questions          enable row level security;
alter table misconceptions     enable row level security;
alter table materials          enable row level security;
alter table goals              enable row level security;
alter table practice_approvals enable row level security;
alter table check_ins          enable row level security;
alter table briefs             enable row level security;

-- The old "Reset demo" button emptied every table. With real accounts that would wipe
-- students' work, so it's gone.
drop function if exists reset_demo_data();
