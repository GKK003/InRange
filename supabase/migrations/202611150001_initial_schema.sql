create extension if not exists pgcrypto;
create type log_type as enum ('meal','activity','stress','note');
create table if not exists glucose_readings (
 id uuid primary key default gen_random_uuid(), value_mgdl int not null, value_mmol numeric(4,1),
 trend text, recorded_at timestamptz not null unique
);
create index if not exists glucose_readings_recorded_at_idx on glucose_readings(recorded_at desc);
create table if not exists daily_logs (
 id uuid primary key default gen_random_uuid(), type log_type not null, title text not null,
 carbs_grams numeric(5,1), fiber_grams numeric(5,1), glycemic_note text, logged_at timestamptz not null default now()
);
create index if not exists daily_logs_logged_at_idx on daily_logs(logged_at desc);
create table if not exists saved_meals (
 id uuid primary key default gen_random_uuid(), name text not null, brand text, barcode text, serving_size text not null,
 carbs_grams numeric(5,1) not null, fiber_grams numeric(5,1) not null default 0, category text, notes text
);
create table if not exists supplies_and_sensor (
 id uuid primary key default gen_random_uuid(), sensor_started_at timestamptz, sensor_duration_days int not null default 10,
 last_site_location text, sensors_left int, insulin_pens_left int
);
create table if not exists quick_alerts (
 id uuid primary key default gen_random_uuid(), status_type text not null check(status_type in ('low_help','high_space','burnt_out','all_good')),
 message text, created_at timestamptz not null default now()
);
