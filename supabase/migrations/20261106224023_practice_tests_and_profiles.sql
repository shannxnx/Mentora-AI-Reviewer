begin;
create schema if not exists mentora_private;
revoke all on schema mentora_private from public, anon;
grant usage on schema mentora_private to authenticated;

create table public.student_profiles (
  owner_id uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text not null default '' check(length(display_name)<=100),
  course text not null default '' check(length(course)<=120),
  year_level text not null default '' check(length(year_level)<=40),
  learning_goal text not null default '' check(length(learning_goal)<=300),
  favorite_subject text not null default '' check(length(favorite_subject)<=100),
  avatar text not null default '' check(length(avatar)<=200000 and (avatar='' or avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'))
);
create table public.practice_tests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null,
  subject_name text not null,
  title text not null check(length(title) between 1 and 200),
  settings jsonb not null check(jsonb_typeof(settings)='object'),
  questions jsonb not null check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 1 and 50),
  encrypted_key text not null check(length(encrypted_key)<1500000),
  grading_hash text not null check(grading_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique(id,owner_id),
  foreign key(subject_id,owner_id) references public.study_subjects(id,owner_id)
);
create index practice_tests_owner_recent on public.practice_tests(owner_id,created_at desc);
create index practice_tests_subject on public.practice_tests(subject_id,owner_id);
create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  test_id uuid not null,
  status text not null default 'active' check(status in ('active','submitted','graded')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  revision integer not null default 0,
  answers jsonb not null default '{}' check(jsonb_typeof(answers)='object' and length(answers::text)<250000),
  result jsonb,
  score numeric check(score between 0 and 100),
  foreign key(test_id,owner_id) references public.practice_tests(id,owner_id) on delete cascade
);
create index practice_attempts_owner_recent on public.practice_attempts(owner_id,started_at desc);
create index practice_attempts_test on public.practice_attempts(test_id,owner_id);
create unique index practice_one_active on public.practice_attempts(owner_id,test_id) where status='active';

create table public.study_activity (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null default current_date,
  kind text not null check(kind in ('reviewer','flashcards','test')),
  seconds integer not null default 0 check(seconds>=0),
  primary key(owner_id,day,kind)
);
create table public.study_recent_activity (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  resource text not null check(length(resource)<=200),
  kind text not null check(kind in ('reviewer','flashcards','test')),
  title text not null check(length(title)<=200),
  last_seen timestamptz not null default now(),
  primary key(owner_id,resource,kind)
);
create table mentora_private.activity_clock (
  owner_id uuid primary key references auth.users on delete cascade,
  last_seen timestamptz not null default now()
);
alter table mentora_private.activity_clock enable row level security;
revoke all on mentora_private.activity_clock from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['student_profiles','practice_tests','practice_attempts','study_activity','study_recent_activity'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('create policy own_rows on public.%I for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()))',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
grant insert,update on public.student_profiles to authenticated;
grant insert(subject_id,subject_name,title,settings,questions,encrypted_key,grading_hash) on public.practice_tests to authenticated;

-- Private functions own transitions; invoker wrappers expose only those operations.
create function mentora_private.practice_start(p_test uuid) returns public.practice_attempts
language plpgsql security definer set search_path='' as $$
declare t public.practice_tests; a public.practice_attempts; mins integer;
begin
  select * into strict t from public.practice_tests where id=p_test and owner_id=auth.uid() for update;
  update public.practice_attempts set status='submitted',submitted_at=expires_at,revision=revision+1
    where owner_id=auth.uid() and test_id=p_test and status='active' and expires_at<=now();
  select * into a from public.practice_attempts where test_id=p_test and owner_id=auth.uid() and status='active';
  if found then return a; end if;
  mins := (t.settings->>'minutes')::integer;
  if mins is not null and mins not between 1 and 180 then raise exception 'Invalid time limit'; end if;
  insert into public.practice_attempts(owner_id,test_id,expires_at)
    values(auth.uid(),p_test,case when mins is null then null else now()+make_interval(mins=>mins) end) returning * into a;
  return a;
end $$;
create function public.practice_start(p_test uuid) returns jsonb
language sql security invoker set search_path='' as $$ select to_jsonb(mentora_private.practice_start(p_test)); $$;

create function mentora_private.practice_save(p_attempt uuid,p_revision integer,p_answers jsonb,p_submit boolean default false)
returns public.practice_attempts language plpgsql security definer set search_path='' as $$
declare a public.practice_attempts; q jsonb; k text; v jsonb;
begin
  select * into strict a from public.practice_attempts where id=p_attempt and owner_id=auth.uid() for update;
  if a.status<>'active' then return a; end if;
  if a.expires_at<=now() then
    update public.practice_attempts set status='submitted',submitted_at=expires_at,revision=revision+1 where id=a.id returning * into a;
    return a;
  end if;
  if a.revision is distinct from p_revision then raise exception 'This attempt changed in another tab. Reload to continue.' using errcode='40001'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' or length(p_answers::text)>250000 then raise exception 'Invalid answers'; end if;
  select questions into q from public.practice_tests where id=a.test_id;
  for k,v in select * from jsonb_each(p_answers) loop
    if jsonb_typeof(v)<>'string' or length(v#>>'{}')>4000 or not exists(select from jsonb_array_elements(q) x where x->>'id'=k)
      then raise exception 'Invalid answer'; end if;
  end loop;
  update public.practice_attempts set answers=p_answers,revision=revision+1,
    status=case when p_submit then 'submitted' else 'active' end,
    submitted_at=case when p_submit then now() else null end
    where id=a.id returning * into a;
  return a;
end $$;
create function public.practice_save(p_attempt uuid,p_revision integer,p_answers jsonb,p_submit boolean default false)
returns jsonb language sql security invoker set search_path='' as $$ select to_jsonb(mentora_private.practice_save(p_attempt,p_revision,p_answers,p_submit)); $$;

create function mentora_private.practice_finish(p_attempt uuid,p_token text,p_result jsonb)
returns public.practice_attempts language plpgsql security definer set search_path='' as $$
declare a public.practice_attempts; t public.practice_tests; earned numeric; n integer;
begin
  select * into strict a from public.practice_attempts where id=p_attempt and owner_id=auth.uid() for update;
  select * into strict t from public.practice_tests where id=a.test_id and owner_id=auth.uid();
  if t.grading_hash is distinct from encode(extensions.digest(p_token,'sha256'),'hex') then raise exception 'Invalid grading capability'; end if;
  if a.status='graded' then return a; end if;
  if a.status<>'submitted' then raise exception 'Submit before grading'; end if;
  if jsonb_typeof(p_result->'items') is distinct from 'array' then raise exception 'Invalid results'; end if;
  n := jsonb_array_length(t.questions);
  if jsonb_array_length(p_result->'items')<>n or exists(select from jsonb_array_elements(p_result->'items') i where (i->>'points')::numeric not in(0,0.5,1))
    then raise exception 'Invalid results'; end if;
  select sum((i->>'points')::numeric) into earned from jsonb_array_elements(p_result->'items') i;
  p_result := p_result || jsonb_build_object('earned',earned,'total',n,'percentage',round(earned/n*100));
  update public.practice_attempts set status='graded',result=p_result,score=round(earned/n*100) where id=a.id returning * into a;
  return a;
end $$;
create function public.practice_finish(p_attempt uuid,p_token text,p_result jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select to_jsonb(mentora_private.practice_finish(p_attempt,p_token,p_result)); $$;

create function mentora_private.practice_expire() returns void language sql security definer set search_path='' as $$
  update public.practice_attempts set status='submitted',submitted_at=expires_at,revision=revision+1
    where owner_id=auth.uid() and status='active' and expires_at<=now();
$$;
create function public.practice_expire() returns void language sql security invoker set search_path='' as $$ select mentora_private.practice_expire(); $$;

create function mentora_private.study_heartbeat(p_kind text,p_resource text,p_title text) returns void
language plpgsql security definer set search_path='' as $$
declare last_tick timestamptz; elapsed integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_kind not in('reviewer','flashcards','test') or length(p_resource) not between 1 and 200 or length(p_title) not between 1 and 200 then raise exception 'Invalid activity'; end if;
  insert into mentora_private.activity_clock(owner_id) values(auth.uid()) on conflict do nothing;
  select last_seen into last_tick from mentora_private.activity_clock where owner_id=auth.uid() for update;
  elapsed := floor(extract(epoch from (now()-last_tick)));
  if elapsed>=10 then
    update mentora_private.activity_clock set last_seen=now() where owner_id=auth.uid();
    if elapsed<=40 then
      insert into public.study_activity(owner_id,day,kind,seconds) values(auth.uid(),current_date,p_kind,elapsed)
      on conflict(owner_id,day,kind) do update set seconds=public.study_activity.seconds+excluded.seconds;
    end if;
  end if;
  insert into public.study_recent_activity(owner_id,resource,kind,title) values(auth.uid(),p_resource,p_kind,p_title)
    on conflict(owner_id,resource,kind) do update set last_seen=now(),title=excluded.title;
end $$;
create function public.study_heartbeat(p_kind text,p_resource text,p_title text) returns void language sql security invoker set search_path='' as $$ select mentora_private.study_heartbeat(p_kind,p_resource,p_title); $$;

create function public.student_summary() returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object(
    'subjects',(select count(*) from public.study_subjects where owner_id=auth.uid()),
    'reviewers',(select count(*) from public.study_reviewers where owner_id=auth.uid()),
    'tests',(select count(*) from public.practice_attempts where owner_id=auth.uid() and status='graded'),
    'average',(select round(avg(score)) from public.practice_attempts where owner_id=auth.uid() and status='graded'),
    'seconds',(select coalesce(sum(seconds),0) from public.study_activity where owner_id=auth.uid()),
    'topics',coalesce((select jsonb_agg(x) from (
      select i->>'topicKey' as key,max(i->>'topic') as name,max(i->>'reviewerId') as "reviewerId",count(*) as count,round(avg((i->>'points')::numeric)*100) as percentage
      from public.practice_attempts a cross join lateral jsonb_array_elements(a.result->'items') i
      where a.owner_id=auth.uid() and a.status='graded' group by i->>'topicKey' order by avg((i->>'points')::numeric) limit 12
    ) x),'[]'::jsonb)
  );
$$;

do $$ declare f record; begin
  for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='mentora_private' or n.nspname='public') and p.proname in('practice_start','practice_save','practice_finish','practice_expire','study_heartbeat','student_summary') loop
    execute format('revoke all on function %I.%I(%s) from public,anon',f.nspname,f.proname,f.args);
    execute format('grant execute on function %I.%I(%s) to authenticated',f.nspname,f.proname,f.args);
  end loop;
end $$;
commit;
