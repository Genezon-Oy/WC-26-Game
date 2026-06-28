create table if not exists public.player_stats (
    id uuid default gen_random_uuid() primary key,
    api_player_id integer unique not null,
    player_name text not null,
    team_name text not null references public.teams(name) on update cascade on delete cascade,
    goals integer default 0,
    assists integer default 0,
    penalties integer default 0,
    played_matches integer default 0,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS policies
alter table public.player_stats enable row level security;

create policy "Enable read access for all users on player_stats"
    on public.player_stats for select
    using (true);

-- No insert/update policies for normal users, only service role will write to this table
