alter table public.antidepressant_master
  add column if not exists category_id uuid references public.categories (id) on delete cascade;

alter table public.pending_antidepressant_edits
  add column if not exists category_id uuid references public.categories (id) on delete cascade;

update public.pending_antidepressant_edits pending
set category_id = master.category_id
from public.antidepressant_master master
where pending.drug_id = master.id
  and pending.category_id is null;

create index if not exists antidepressant_master_category_active_idx
  on public.antidepressant_master (category_id, is_active, line_of_treatment, drug_name);

create index if not exists pending_antidepressant_edits_category_status_idx
  on public.pending_antidepressant_edits (category_id, status, created_at desc);

do $$
begin
  if not exists (
    select 1
    from public.antidepressant_master
    where category_id is null
  ) then
    alter table public.antidepressant_master
      alter column category_id set not null;
  end if;

  if not exists (
    select 1
    from public.pending_antidepressant_edits
    where category_id is null
  ) then
    alter table public.pending_antidepressant_edits
      alter column category_id set not null;
  end if;
end;
$$;

drop function if exists public.create_antidepressant_with_audit(uuid, text, integer, integer, integer, integer, integer, text);
drop function if exists public.submit_antidepressant_pending_edit(uuid, text, integer, integer, integer, integer, integer, text);

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
