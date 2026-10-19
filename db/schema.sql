-- ClosingDesk PostgreSQL schema.
-- The local app stores the same entities in an encrypted file so it can run
-- without a database server. This schema is the target shape for hosted use.

create table users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null
);

create table matters (
  id text primary key,
  user_id text not null references users (id),
  property_address text not null,
  client_name text not null default '',
  matter_name text not null default '',
  closing_date date,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table documents (
  id text primary key,
  matter_id text not null references matters (id),
  role text not null check (role in ('offer', 'psa', 'addendum')),
  filename text not null,
  mime_type text not null,
  byte_size integer not null,
  version integer not null,
  is_controlling boolean not null,
  storage_key text not null,
  page_count integer not null,
  extraction_status text not null,
  extraction_warning text,
  uploaded_at timestamptz not null,
  uploaded_by text not null references users (id)
);

create table document_versions (
  id text primary key,
  document_id text not null references documents (id),
  version integer not null,
  storage_key text not null,
  created_at timestamptz not null
);

create table comparison_runs (
  id text primary key,
  matter_id text not null references matters (id),
  psa_document_id text not null references documents (id),
  created_at timestamptz not null,
  created_by text not null references users (id),
  method text not null,
  model_note text,
  summary jsonb not null
);

create table extracted_terms (
  id text primary key,
  document_id text not null references documents (id),
  run_id text references comparison_runs (id),
  category text not null,
  label text not null,
  normalized text,
  quote text not null,
  page integer,
  section text
);

create table findings (
  id text primary key,
  run_id text not null references comparison_runs (id),
  provision_id text not null,
  category text not null,
  status text not null,
  severity text not null,
  confidence numeric not null,
  title text not null,
  explanation text not null,
  offer_quote text not null,
  offer_page integer,
  offer_section text,
  offer_document_id text references documents (id),
  psa_quote text not null,
  psa_page integer,
  psa_section text,
  psa_document_id text references documents (id)
);

create table attorney_reviews (
  id text primary key,
  finding_id text not null references findings (id),
  user_id text not null references users (id),
  action text not null,
  note text not null default '',
  created_at timestamptz not null
);

create table audit_events (
  id text primary key,
  matter_id text references matters (id),
  user_id text references users (id),
  action text not null,
  detail text not null,
  created_at timestamptz not null
);
