-- Migration for roulette/double game mode
create table if not exists roulettedoublegame (
  id uuid primary key default gen_random_uuid(),
  starttime timestamptz not null,
  endtime timestamptz,
  status text not null,
  bettingwindowend timestamptz,
  color text,
  number integer
);

create table if not exists roulettebet (
  id uuid primary key default gen_random_uuid(),
  gameid uuid references roulettedoublegame(id) on delete cascade,
  userid uuid not null,
  color text not null,
  amount numeric not null,
  createdat timestamptz default now()
);

create index if not exists idx_roulettebet_gameid on roulettebet(gameid);
