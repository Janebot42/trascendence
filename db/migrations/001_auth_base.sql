create table if not exists users (
  id text primary key,
  username text not null unique,
  email text unique,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists password_credentials (
  user_id text primary key references users(id) on delete cascade,
  password_hash text not null,
  password_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  session_token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_address text,
  user_agent text,
  reauthenticated_at timestamptz
);

create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

create table if not exists login_challenges (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  challenge_token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  ip_address text,
  user_agent text
);

create index if not exists login_challenges_user_id_idx on login_challenges(user_id);
create index if not exists login_challenges_expires_at_idx on login_challenges(expires_at);

create table if not exists two_factor_totp (
  id text primary key,
  user_id text not null unique references users(id) on delete cascade,
  secret_encrypted text not null,
  enabled_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recovery_codes (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  replaced_at timestamptz
);

create index if not exists recovery_codes_user_id_idx on recovery_codes(user_id);

create table if not exists oauth_accounts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null check (provider in ('42')),
  provider_user_id text not null,
  provider_login text,
  provider_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create index if not exists oauth_accounts_user_id_idx on oauth_accounts(user_id);

create table if not exists oauth_states (
  id text primary key,
  provider text not null check (provider in ('42')),
  purpose text not null default 'login' check (purpose in ('login', 'link')),
  initiating_user_id text references users(id) on delete cascade,
  state_token_hash text not null unique,
  redirect_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists oauth_states_expires_at_idx on oauth_states(expires_at);
