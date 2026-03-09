create extension if not exists pgcrypto;

create table if not exists public.antidepressant_master (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  drug_name text not null,
  line_of_treatment integer not null check (line_of_treatment in (1, 2, 3)),
  initiation_dose_mg integer not null check (initiation_dose_mg >= 0),
  therapeutic_min_dose_mg integer not null check (therapeutic_min_dose_mg >= initiation_dose_mg),
  therapeutic_max_dose_mg integer not null check (therapeutic_max_dose_mg >= therapeutic_min_dose_mg),
  max_dose_mg integer not null check (max_dose_mg >= therapeutic_max_dose_mg),
  updated_at timestamptz not null default timezone('utc', now()),
  is_active boolean not null default true
);

create table if not exists public.edit_audit_log (
  id uuid primary key default gen_random_uuid(),
  drug_id uuid not null references public.antidepressant_master (id) on delete cascade,
  changed_by_user_id uuid not null references auth.users (id) on delete restrict,
  previous_data jsonb not null,
  new_data jsonb not null,
  change_reason text not null check (char_length(trim(change_reason)) > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pending_antidepressant_edits (
  id uuid primary key default gen_random_uuid(),
  drug_id uuid not null references public.antidepressant_master (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  proposed_by_user_id uuid not null references auth.users (id) on delete restrict,
  previous_data jsonb not null,
  proposed_data jsonb not null,
  change_reason text not null check (char_length(trim(change_reason)) > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by_user_id uuid references auth.users (id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists antidepressant_master_category_active_idx
  on public.antidepressant_master (category_id, is_active, line_of_treatment, drug_name);

create index if not exists edit_audit_log_drug_created_idx
  on public.edit_audit_log (drug_id, created_at desc);

create index if not exists pending_antidepressant_edits_category_status_idx
  on public.pending_antidepressant_edits (category_id, status, created_at desc);

create index if not exists pending_antidepressant_edits_proposed_by_idx
  on public.pending_antidepressant_edits (proposed_by_user_id, created_at desc);

create or replace function public.antidepressant_snapshot(
  p_drug_name text,
  p_line_of_treatment integer,
  p_initiation_dose_mg integer,
  p_therapeutic_min_dose_mg integer,
  p_therapeutic_max_dose_mg integer,
  p_max_dose_mg integer
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'drug_name', trim(p_drug_name),
    'line_of_treatment', p_line_of_treatment,
    'initiation_dose_mg', p_initiation_dose_mg,
    'therapeutic_min_dose_mg', p_therapeutic_min_dose_mg,
    'therapeutic_max_dose_mg', p_therapeutic_max_dose_mg,
    'max_dose_mg', p_max_dose_mg
  );
$$;

create or replace function public.set_antidepressant_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists antidepressant_master_set_updated_at on public.antidepressant_master;
create trigger antidepressant_master_set_updated_at
before update on public.antidepressant_master
for each row
execute function public.set_antidepressant_updated_at();

create or replace function public.is_treatment_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

create or replace function public.is_treatment_editor()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('super_admin', 'sub_admin')
  );
$$;

alter table public.antidepressant_master enable row level security;
alter table public.edit_audit_log enable row level security;
alter table public.pending_antidepressant_edits enable row level security;

drop policy if exists "authenticated can read antidepressant master" on public.antidepressant_master;
create policy "authenticated can read antidepressant master"
on public.antidepressant_master
for select
to authenticated
using (true);

drop policy if exists "authenticated can read audit log" on public.edit_audit_log;
create policy "authenticated can read audit log"
on public.edit_audit_log
for select
to authenticated
using (true);

drop policy if exists "treatment users can read pending edits" on public.pending_antidepressant_edits;
create policy "treatment users can read pending edits"
on public.pending_antidepressant_edits
for select
to authenticated
using (
  public.is_treatment_admin()
  or proposed_by_user_id = auth.uid()
);

drop policy if exists "super admins can update antidepressant master directly" on public.antidepressant_master;
create policy "super admins can update antidepressant master directly"
on public.antidepressant_master
for update
to authenticated
using (public.is_treatment_admin())
with check (public.is_treatment_admin());

drop function if exists public.create_antidepressant_with_audit(uuid, text, integer, integer, integer, integer, integer, text);
drop function if exists public.update_antidepressant_with_audit(uuid, text, integer, text, text, text, text);
drop function if exists public.submit_antidepressant_pending_edit(uuid, text, integer, text, text, text, text);

create or replace function public.create_antidepressant_with_audit(
  p_category_id uuid,
  p_drug_name text,
  p_line_of_treatment integer,
  p_initiation_dose_mg integer,
  p_therapeutic_min_dose_mg integer,
  p_therapeutic_max_dose_mg integer,
  p_max_dose_mg integer,
  p_change_reason text
)
returns public.antidepressant_master
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created public.antidepressant_master%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_treatment_admin() then
    raise exception 'Only super admins can create antidepressant master data';
  end if;

  if trim(coalesce(p_change_reason, '')) = '' then
    raise exception 'Change reason is required';
  end if;

  insert into public.antidepressant_master (
    category_id,
    drug_name,
    line_of_treatment,
    initiation_dose_mg,
    therapeutic_min_dose_mg,
    therapeutic_max_dose_mg,
    max_dose_mg
  )
  values (
    p_category_id,
    trim(p_drug_name),
    p_line_of_treatment,
    p_initiation_dose_mg,
    p_therapeutic_min_dose_mg,
    p_therapeutic_max_dose_mg,
    p_max_dose_mg
  )
  returning *
  into v_created;

  insert into public.edit_audit_log (
    drug_id,
    changed_by_user_id,
    previous_data,
    new_data,
    change_reason
  )
  values (
    v_created.id,
    auth.uid(),
    '{}'::jsonb,
    public.antidepressant_snapshot(
      v_created.drug_name,
      v_created.line_of_treatment,
      v_created.initiation_dose_mg,
      v_created.therapeutic_min_dose_mg,
      v_created.therapeutic_max_dose_mg,
      v_created.max_dose_mg
    ),
    trim(p_change_reason)
  );

  return v_created;
end;
$$;

create or replace function public.update_antidepressant_with_audit(
  p_drug_id uuid,
  p_drug_name text,
  p_line_of_treatment integer,
  p_initiation_dose_mg integer,
  p_therapeutic_min_dose_mg integer,
  p_therapeutic_max_dose_mg integer,
  p_max_dose_mg integer,
  p_change_reason text
)
returns public.antidepressant_master
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.antidepressant_master%rowtype;
  v_updated public.antidepressant_master%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_treatment_admin() then
    raise exception 'Only super admins can update antidepressant master data';
  end if;

  if trim(coalesce(p_change_reason, '')) = '' then
    raise exception 'Change reason is required';
  end if;

  select *
  into v_previous
  from public.antidepressant_master
  where id = p_drug_id
  for update;

  if not found then
    raise exception 'Drug entry not found';
  end if;

  update public.antidepressant_master
  set
    drug_name = trim(p_drug_name),
    line_of_treatment = p_line_of_treatment,
    initiation_dose_mg = p_initiation_dose_mg,
    therapeutic_min_dose_mg = p_therapeutic_min_dose_mg,
    therapeutic_max_dose_mg = p_therapeutic_max_dose_mg,
    max_dose_mg = p_max_dose_mg
  where id = p_drug_id
  returning *
  into v_updated;

  insert into public.edit_audit_log (
    drug_id,
    changed_by_user_id,
    previous_data,
    new_data,
    change_reason
  )
  values (
    p_drug_id,
    auth.uid(),
    public.antidepressant_snapshot(
      v_previous.drug_name,
      v_previous.line_of_treatment,
      v_previous.initiation_dose_mg,
      v_previous.therapeutic_min_dose_mg,
      v_previous.therapeutic_max_dose_mg,
      v_previous.max_dose_mg
    ),
    public.antidepressant_snapshot(
      v_updated.drug_name,
      v_updated.line_of_treatment,
      v_updated.initiation_dose_mg,
      v_updated.therapeutic_min_dose_mg,
      v_updated.therapeutic_max_dose_mg,
      v_updated.max_dose_mg
    ),
    trim(p_change_reason)
  );

  return v_updated;
end;
$$;

create or replace function public.submit_antidepressant_pending_edit(
  p_drug_id uuid,
  p_drug_name text,
  p_line_of_treatment integer,
  p_initiation_dose_mg integer,
  p_therapeutic_min_dose_mg integer,
  p_therapeutic_max_dose_mg integer,
  p_max_dose_mg integer,
  p_change_reason text
)
returns public.pending_antidepressant_edits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.antidepressant_master%rowtype;
  v_pending public.pending_antidepressant_edits%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_treatment_editor() then
    raise exception 'Only treatment editors can submit change proposals';
  end if;

  if trim(coalesce(p_change_reason, '')) = '' then
    raise exception 'Change reason is required';
  end if;

  select *
  into v_previous
  from public.antidepressant_master
  where id = p_drug_id;

  if not found then
    raise exception 'Drug entry not found';
  end if;

  insert into public.pending_antidepressant_edits (
    drug_id,
    category_id,
    proposed_by_user_id,
    previous_data,
    proposed_data,
    change_reason
  )
  values (
    p_drug_id,
    v_previous.category_id,
    auth.uid(),
    public.antidepressant_snapshot(
      v_previous.drug_name,
      v_previous.line_of_treatment,
      v_previous.initiation_dose_mg,
      v_previous.therapeutic_min_dose_mg,
      v_previous.therapeutic_max_dose_mg,
      v_previous.max_dose_mg
    ),
    public.antidepressant_snapshot(
      p_drug_name,
      p_line_of_treatment,
      p_initiation_dose_mg,
      p_therapeutic_min_dose_mg,
      p_therapeutic_max_dose_mg,
      p_max_dose_mg
    ),
    trim(p_change_reason)
  )
  returning *
  into v_pending;

  return v_pending;
end;
$$;

create or replace function public.approve_antidepressant_pending_edit(
  p_pending_edit_id uuid,
  p_review_note text default null
)
returns public.antidepressant_master
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending public.pending_antidepressant_edits%rowtype;
  v_previous public.antidepressant_master%rowtype;
  v_updated public.antidepressant_master%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_treatment_admin() then
    raise exception 'Only super admins can approve pending edits';
  end if;

  select *
  into v_pending
  from public.pending_antidepressant_edits
  where id = p_pending_edit_id
  for update;

  if not found then
    raise exception 'Pending edit not found';
  end if;

  if v_pending.status <> 'pending' then
    raise exception 'Pending edit has already been reviewed';
  end if;

  select *
  into v_previous
  from public.antidepressant_master
  where id = v_pending.drug_id
  for update;

  if not found then
    raise exception 'Drug entry not found';
  end if;

  if public.antidepressant_snapshot(
    v_previous.drug_name,
    v_previous.line_of_treatment,
    v_previous.initiation_dose_mg,
    v_previous.therapeutic_min_dose_mg,
    v_previous.therapeutic_max_dose_mg,
    v_previous.max_dose_mg
  ) <> v_pending.previous_data then
    raise exception 'Master entry changed after proposal submission. Reject and resubmit against the latest data.';
  end if;

  update public.antidepressant_master
  set
    drug_name = trim(v_pending.proposed_data ->> 'drug_name'),
    line_of_treatment = (v_pending.proposed_data ->> 'line_of_treatment')::integer,
    initiation_dose_mg = (v_pending.proposed_data ->> 'initiation_dose_mg')::integer,
    therapeutic_min_dose_mg = (v_pending.proposed_data ->> 'therapeutic_min_dose_mg')::integer,
    therapeutic_max_dose_mg = (v_pending.proposed_data ->> 'therapeutic_max_dose_mg')::integer,
    max_dose_mg = (v_pending.proposed_data ->> 'max_dose_mg')::integer
  where id = v_pending.drug_id
  returning *
  into v_updated;

  insert into public.edit_audit_log (
    drug_id,
    changed_by_user_id,
    previous_data,
    new_data,
    change_reason
  )
  values (
    v_pending.drug_id,
    auth.uid(),
    public.antidepressant_snapshot(
      v_previous.drug_name,
      v_previous.line_of_treatment,
      v_previous.initiation_dose_mg,
      v_previous.therapeutic_min_dose_mg,
      v_previous.therapeutic_max_dose_mg,
      v_previous.max_dose_mg
    ),
    public.antidepressant_snapshot(
      v_updated.drug_name,
      v_updated.line_of_treatment,
      v_updated.initiation_dose_mg,
      v_updated.therapeutic_min_dose_mg,
      v_updated.therapeutic_max_dose_mg,
      v_updated.max_dose_mg
    ),
    trim(v_pending.change_reason)
  );

  update public.pending_antidepressant_edits
  set
    status = 'approved',
    review_note = nullif(trim(coalesce(p_review_note, '')), ''),
    reviewed_by_user_id = auth.uid(),
    reviewed_at = timezone('utc', now())
  where id = v_pending.id;

  return v_updated;
end;
$$;

create or replace function public.reject_antidepressant_pending_edit(
  p_pending_edit_id uuid,
  p_review_note text default null
)
returns public.pending_antidepressant_edits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending public.pending_antidepressant_edits%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_treatment_admin() then
    raise exception 'Only super admins can reject pending edits';
  end if;

  select *
  into v_pending
  from public.pending_antidepressant_edits
  where id = p_pending_edit_id
  for update;

  if not found then
    raise exception 'Pending edit not found';
  end if;

  if v_pending.status <> 'pending' then
    raise exception 'Pending edit has already been reviewed';
  end if;

  update public.pending_antidepressant_edits
  set
    status = 'rejected',
    review_note = nullif(trim(coalesce(p_review_note, '')), ''),
    reviewed_by_user_id = auth.uid(),
    reviewed_at = timezone('utc', now())
  where id = v_pending.id
  returning *
  into v_pending;

  return v_pending;
end;
$$;

grant execute on function public.update_antidepressant_with_audit(
  uuid,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text
) to authenticated;

grant execute on function public.create_antidepressant_with_audit(
  uuid,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text
) to authenticated;

grant execute on function public.submit_antidepressant_pending_edit(
  uuid,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text
) to authenticated;

grant execute on function public.approve_antidepressant_pending_edit(
  uuid,
  text
) to authenticated;

grant execute on function public.reject_antidepressant_pending_edit(
  uuid,
  text
) to authenticated;
