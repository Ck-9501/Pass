create extension if not exists pgcrypto;
create table events(id uuid primary key default gen_random_uuid(),owner uuid not null default auth.uid() references auth.users,name text not null,date date,time text,venue text,organizer text,logo_url text,created_at timestamptz default now());
create table guests(id uuid primary key default gen_random_uuid(),event_id uuid not null references events on delete cascade,name text not null check(length(trim(name))>0),phone text,pass_type text not null default 'Regular' check(pass_type in('Regular','VIP','Group','Organizer')),pass_id text not null unique,qr_token text not null unique,status text not null default 'valid' check(status in('valid','checked_in','revoked')),notes text,created_at timestamptz default now(),checked_in_at timestamptz);
create table checkins(id uuid primary key default gen_random_uuid(),guest_id uuid not null references guests on delete cascade,scanned_at timestamptz default now(),device text);
alter table events enable row level security;alter table guests enable row level security;alter table checkins enable row level security;
create policy ev_own on events for all to authenticated using(owner=auth.uid()) with check(owner=auth.uid());
create policy gu_own on guests for all to authenticated using(exists(select 1 from events e where e.id=event_id and e.owner=auth.uid())) with check(exists(select 1 from events e where e.id=event_id and e.owner=auth.uid()));
create policy ci_own on checkins for select to authenticated using(exists(select 1 from guests g join events e on e.id=g.event_id where g.id=guest_id and e.owner=auth.uid()));
create or replace function check_in(p_token text,p_device text default null) returns json language plpgsql security definer set search_path=public as $$
declare g guests;begin
update guests set status='checked_in',checked_in_at=now() where qr_token=p_token and status='valid' and exists(select 1 from events e where e.id=event_id and e.owner=auth.uid()) returning * into g;
if found then insert into checkins(guest_id,device) values(g.id,p_device);return json_build_object('result','valid','name',g.name,'pass_type',g.pass_type,'pass_id',g.pass_id,'at',g.checked_in_at);end if;
select gu.* into g from guests gu join events e on e.id=gu.event_id where gu.qr_token=p_token and e.owner=auth.uid();
if not found then return json_build_object('result','invalid');end if;
if g.status='revoked' then return json_build_object('result','revoked');end if;
return json_build_object('result','already','name',g.name,'pass_id',g.pass_id,'at',g.checked_in_at);end $$;
