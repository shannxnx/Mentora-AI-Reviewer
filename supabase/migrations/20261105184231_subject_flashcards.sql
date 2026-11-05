begin;

create table public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 100),
  enrolled_by uuid references auth.users on delete set null,
  unique (id, owner_id)
);
create unique index study_subject_name on public.study_subjects(owner_id, lower(name));

create table public.study_reviewers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  subject_id uuid not null,
  fingerprint text not null,
  file_name text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  folder text check (length(folder) between 1 and 100),
  unique (id, owner_id), unique(owner_id, subject_id, fingerprint),
  foreign key (subject_id, owner_id) references public.study_subjects(id, owner_id) on delete cascade
);

create table public.study_decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  reviewer_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  settings_key text not null,
  unique (id, owner_id), unique (reviewer_id, settings_key),
  foreign key (reviewer_id, owner_id) references public.study_reviewers(id, owner_id) on delete cascade
);

create table public.study_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  deck_id uuid not null,
  topic integer not null check (topic >= 0),
  front text not null check (length(btrim(front)) between 1 and 2000),
  back text not null check (length(btrim(back)) between 1 and 3000),
  evidence text not null default '',
  origin text not null check (origin in ('reviewer','illustration','student')),
  revision integer not null default 1,
  known_streak integer not null default 0,
  due_at timestamptz not null default now(),
  last_rating text check (last_rating in ('known','learning')),
  unique(id, owner_id),
  foreign key (deck_id, owner_id) references public.study_decks(id, owner_id) on delete cascade
);
create unique index study_card_question on public.study_cards(deck_id, lower(btrim(front)));
create index study_card_due on public.study_cards(owner_id, due_at);

create table public.study_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null,
  card_id uuid not null,
  deck_id uuid not null,
  topic integer not null,
  revision integer not null,
  rating text not null check(rating in ('known','learning')),
  reviewed_at timestamptz not null default now(),
  due_at timestamptz not null,
  unique(owner_id, session_id, card_id)
);
create index study_review_recent on public.study_reviews(owner_id, reviewed_at desc);

create table public.study_generation_jobs (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  job_key text not null, token uuid not null, expires_at timestamptz not null,
  primary key(owner_id, job_key)
);

-- Every foreign key crossing private resources includes the owner.
do $$
declare t text;
begin
  foreach t in array array['study_subjects','study_reviewers','study_decks','study_cards','study_reviews','study_generation_jobs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('create policy own_rows on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',t);
  end loop;
end $$;
grant select on public.study_subjects, public.study_reviewers, public.study_decks, public.study_cards, public.study_reviews to authenticated;
grant insert(name) on public.study_subjects to authenticated;
grant insert(subject_id,fingerprint,file_name,snapshot,folder), update(folder) on public.study_reviewers to authenticated;
grant update(title) on public.study_decks to authenticated;
grant insert(deck_id,topic,front,back,origin), update(front,back), delete on public.study_cards to authenticated;

-- Teacher status is an administrator-issued auth app_metadata claim.
create function public.study_enroll(student_email text, subject_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare student uuid;
begin
  if auth.uid() is null or not exists (select from auth.users where id=auth.uid() and raw_app_meta_data->>'role'='teacher') then
    raise exception 'A verified teacher account is required'; end if;
  select id into student from auth.users where lower(email)=lower(btrim(student_email));
  if student is null then raise exception 'Student account not found'; end if;
  insert into public.study_subjects(owner_id,name,enrolled_by) values(student,btrim(subject_name),auth.uid())
  on conflict(owner_id,lower(name)) do update set enrolled_by=excluded.enrolled_by;
end $$;

create function public.study_card_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.front,new.back,new.topic,new.evidence,new.origin) is distinct from (old.front,old.back,old.topic,old.evidence,old.origin) then
    new.revision := old.revision + 1;
    new.known_streak := 0; new.last_rating := null; new.due_at := now();
    if current_user='authenticated' then new.evidence := ''; new.origin := 'student'; end if;
  end if;
  return new;
end $$;
create trigger study_card_revision before update of front,back,topic,evidence,origin on public.study_cards
for each row execute function public.study_card_revision();

create function public.study_rate(p_card uuid, p_session uuid, p_revision integer, p_rating text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare c public.study_cards; next_due timestamptz; streak integer;
begin
  select * into strict c from public.study_cards where id=p_card and owner_id=auth.uid() for update;
  select due_at into next_due from public.study_reviews where owner_id=auth.uid() and session_id=p_session and card_id=p_card;
  if found then
    if not exists(select 1 from public.study_reviews where owner_id=auth.uid() and session_id=p_session and card_id=p_card and rating=p_rating and revision=p_revision) then
      raise exception 'This card already has a different rating in this session';
    end if;
    return next_due;
  end if;
  if c.revision<>p_revision then raise exception 'Card changed. Reopen the deck.'; end if;
  if p_rating is null or p_rating not in ('known','learning') then raise exception 'Invalid rating'; end if;
  streak := case when p_rating='known' then least(c.known_streak+1,4) else 0 end;
  next_due := now() + make_interval(days => case streak when 0 then 1 when 1 then 3 when 2 then 7 when 3 then 14 else 30 end);
  insert into public.study_reviews(owner_id,session_id,card_id,deck_id,topic,revision,rating,due_at)
    values(auth.uid(),p_session,c.id,c.deck_id,c.topic,c.revision,p_rating,next_due);
  update public.study_cards set last_rating=p_rating, known_streak=streak,due_at=next_due where id=c.id;
  return next_due;
end $$;

create function public.study_claim(p_key text, p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if length(p_key)>300 then raise exception 'Invalid generation request'; end if;
  delete from public.study_generation_jobs where owner_id=auth.uid() and expires_at<=now();
  insert into public.study_generation_jobs(owner_id,job_key,token,expires_at)
    values(auth.uid(),p_key,p_token,now()+interval '2 minutes')
    on conflict(owner_id,job_key) do update set token=excluded.token,expires_at=excluded.expires_at
    where public.study_generation_jobs.expires_at <= now();
  return found;
end $$;
create function public.study_release(p_key text,p_token uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.study_generation_jobs where owner_id=auth.uid() and job_key=p_key and token=p_token;
$$;
-- A generation batch either commits with its deck or leaves the old deck intact.
create function public.study_finish(p_reviewer uuid,p_key text,p_token uuid,p_settings text,p_title text,p_cards jsonb,
  p_replace uuid default null,p_revision integer default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare deck uuid; item jsonb;
begin
  perform 1 from public.study_generation_jobs where owner_id=auth.uid() and job_key=p_key and token=p_token and expires_at>now() for update;
  if not found then raise exception 'Generation expired. Try again.'; end if;
  perform 1 from public.study_reviewers where id=p_reviewer and owner_id=auth.uid();
  if not found then raise exception 'Reviewer unavailable'; end if;
  if jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards) not between 1 and 50 then raise exception 'Invalid cards'; end if;
  if p_replace is not null then
    item := p_cards->0;
    update public.study_cards c set front=item->>'front',back=item->>'back',topic=(item->>'topic')::int,
      evidence=item->>'evidence',origin=item->>'origin'
      from public.study_decks d where c.id=p_replace and c.owner_id=auth.uid() and c.revision=p_revision
      and d.id=c.deck_id and d.reviewer_id=p_reviewer returning c.deck_id into strict deck;
  else
    insert into public.study_decks(reviewer_id,owner_id,title,settings_key)
      values(p_reviewer,auth.uid(),p_title,p_settings) on conflict(reviewer_id,settings_key) do nothing returning id into deck;
    if deck is null then
      select id into strict deck from public.study_decks where reviewer_id=p_reviewer and settings_key=p_settings and owner_id=auth.uid();
    else
      insert into public.study_cards(deck_id,owner_id,topic,front,back,evidence,origin)
        select deck,auth.uid(),(v->>'topic')::int,v->>'front',v->>'back',v->>'evidence',v->>'origin' from jsonb_array_elements(p_cards) v;
    end if;
  end if;
  perform public.study_release(p_key,p_token);
  return deck;
end $$;
do $$
declare f regprocedure;
begin
  foreach f in array array[
    'public.study_enroll(text,text)'::regprocedure,'public.study_rate(uuid,uuid,integer,text)'::regprocedure,
    'public.study_claim(text,uuid)'::regprocedure,'public.study_release(text,uuid)'::regprocedure,
    'public.study_finish(uuid,text,uuid,text,text,jsonb,uuid,integer)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public,anon',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;
commit;
