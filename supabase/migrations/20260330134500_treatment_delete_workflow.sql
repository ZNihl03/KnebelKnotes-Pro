update public.pending_antidepressant_edits pending
set
  previous_data = pending.previous_data || jsonb_build_object('is_active', master.is_active),
  proposed_data = pending.proposed_data || jsonb_build_object(
    'is_active',
    coalesce((pending.proposed_data ->> 'is_active')::boolean, master.is_active)
  )
from public.antidepressant_master master
where pending.drug_id = master.id
  and (
    not (pending.previous_data ? 'is_active')
    or not (pending.proposed_data ? 'is_active')
  );

update public.edit_audit_log audit
set
  previous_data = audit.previous_data || jsonb_build_object('is_active', master.is_active),
  new_data = audit.new_data || jsonb_build_object('is_active', master.is_active)
from public.antidepressant_master master
where audit.drug_id = master.id
  and (
    not (audit.previous_data ? 'is_active')
    or not (audit.new_data ? 'is_active')
  );

create or replace function public.antidepressant_snapshot(
  p_drug_name text,
  p_medication_type text,
  p_frequency text,
  p_tolerability_less text,
  p_tolerability_more text,
  p_safety text,
  p_cost text,
  p_line_of_treatment integer,
  p_initiation_dose_mg integer,
  p_therapeutic_min_dose_mg integer,
  p_therapeutic_max_dose_mg integer,
  p_max_dose_mg integer,
  p_is_active boolean
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'drug_name', trim(p_drug_name),
    'medication_type', trim(p_medication_type),
    'frequency', nullif(trim(coalesce(p_frequency, '')), ''),
    'tolerability_less', nullif(trim(coalesce(p_tolerability_less, '')), ''),
    'tolerability_more', nullif(trim(coalesce(p_tolerability_more, '')), ''),
    'safety', nullif(trim(coalesce(p_safety, '')), ''),
    'cost', nullif(trim(coalesce(p_cost, '')), ''),
    'line_of_treatment', p_line_of_treatment,
    'initiation_dose_mg', p_initiation_dose_mg,
    'therapeutic_min_dose_mg', p_therapeutic_min_dose_mg,
    'therapeutic_max_dose_mg', p_therapeutic_max_dose_mg,
    'max_dose_mg', p_max_dose_mg,
    'is_active', p_is_active
  );
$$;

create or replace function public.create_antidepressant_with_audit(
  p_category_id uuid,
  p_drug_name text,
  p_medication_type text,
  p_frequency text,
  p_tolerability_less text,
  p_tolerability_more text,
  p_safety text,
  p_cost text,
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

  if trim(coalesce(p_medication_type, '')) = '' then
    raise exception 'Medication type is required';
  end if;

  if trim(coalesce(p_change_reason, '')) = '' then
    raise exception 'Change reason is required';
  end if;

  insert into public.antidepressant_master (
    category_id,
    drug_name,
    medication_type,
    frequency,
    tolerability_less,
    tolerability_more,
    safety,
    cost,
    line_of_treatment,
    initiation_dose_mg,
    therapeutic_min_dose_mg,
    therapeutic_max_dose_mg,
    max_dose_mg
  )
  values (
    p_category_id,
    trim(p_drug_name),
    trim(p_medication_type),
    nullif(trim(coalesce(p_frequency, '')), ''),
    nullif(trim(coalesce(p_tolerability_less, '')), ''),
    nullif(trim(coalesce(p_tolerability_more, '')), ''),
    nullif(trim(coalesce(p_safety, '')), ''),
    nullif(trim(coalesce(p_cost, '')), ''),
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
      v_created.medication_type,
      v_created.frequency,
      v_created.tolerability_less,
      v_created.tolerability_more,
      v_created.safety,
      v_created.cost,
      v_created.line_of_treatment,
      v_created.initiation_dose_mg,
      v_created.therapeutic_min_dose_mg,
      v_created.therapeutic_max_dose_mg,
      v_created.max_dose_mg,
      v_created.is_active
    ),
    trim(p_change_reason)
  );

  return v_created;
end;
$$;

create or replace function public.update_antidepressant_with_audit(
  p_drug_id uuid,
  p_drug_name text,
  p_medication_type text,
  p_frequency text,
  p_tolerability_less text,
  p_tolerability_more text,
  p_safety text,
  p_cost text,
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

  if trim(coalesce(p_medication_type, '')) = '' then
    raise exception 'Medication type is required';
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

  if not v_previous.is_active then
    raise exception 'Drug entry is already deleted';
  end if;

  update public.antidepressant_master
  set
    drug_name = trim(p_drug_name),
    medication_type = trim(p_medication_type),
    frequency = nullif(trim(coalesce(p_frequency, '')), ''),
    tolerability_less = nullif(trim(coalesce(p_tolerability_less, '')), ''),
    tolerability_more = nullif(trim(coalesce(p_tolerability_more, '')), ''),
    safety = nullif(trim(coalesce(p_safety, '')), ''),
    cost = nullif(trim(coalesce(p_cost, '')), ''),
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
      v_previous.medication_type,
      v_previous.frequency,
      v_previous.tolerability_less,
      v_previous.tolerability_more,
      v_previous.safety,
      v_previous.cost,
      v_previous.line_of_treatment,
      v_previous.initiation_dose_mg,
      v_previous.therapeutic_min_dose_mg,
      v_previous.therapeutic_max_dose_mg,
      v_previous.max_dose_mg,
      v_previous.is_active
    ),
    public.antidepressant_snapshot(
      v_updated.drug_name,
      v_updated.medication_type,
      v_updated.frequency,
      v_updated.tolerability_less,
      v_updated.tolerability_more,
      v_updated.safety,
      v_updated.cost,
      v_updated.line_of_treatment,
      v_updated.initiation_dose_mg,
      v_updated.therapeutic_min_dose_mg,
      v_updated.therapeutic_max_dose_mg,
      v_updated.max_dose_mg,
      v_updated.is_active
    ),
    trim(p_change_reason)
  );

  return v_updated;
end;
$$;

create or replace function public.submit_antidepressant_pending_edit(
  p_drug_id uuid,
  p_drug_name text,
  p_medication_type text,
  p_frequency text,
  p_tolerability_less text,
  p_tolerability_more text,
  p_safety text,
  p_cost text,
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

  if trim(coalesce(p_medication_type, '')) = '' then
    raise exception 'Medication type is required';
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

  if not v_previous.is_active then
    raise exception 'Drug entry is already deleted';
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
      v_previous.medication_type,
      v_previous.frequency,
      v_previous.tolerability_less,
      v_previous.tolerability_more,
      v_previous.safety,
      v_previous.cost,
      v_previous.line_of_treatment,
      v_previous.initiation_dose_mg,
      v_previous.therapeutic_min_dose_mg,
      v_previous.therapeutic_max_dose_mg,
      v_previous.max_dose_mg,
      v_previous.is_active
    ),
    public.antidepressant_snapshot(
      p_drug_name,
      p_medication_type,
      p_frequency,
      p_tolerability_less,
      p_tolerability_more,
      p_safety,
      p_cost,
      p_line_of_treatment,
      p_initiation_dose_mg,
      p_therapeutic_min_dose_mg,
      p_therapeutic_max_dose_mg,
      p_max_dose_mg,
      v_previous.is_active
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
    v_previous.medication_type,
    v_previous.frequency,
    v_previous.tolerability_less,
    v_previous.tolerability_more,
    v_previous.safety,
    v_previous.cost,
    v_previous.line_of_treatment,
    v_previous.initiation_dose_mg,
    v_previous.therapeutic_min_dose_mg,
    v_previous.therapeutic_max_dose_mg,
    v_previous.max_dose_mg,
    v_previous.is_active
  ) <> v_pending.previous_data then
    raise exception 'Master entry changed after proposal submission. Reject and resubmit against the latest data.';
  end if;

  update public.antidepressant_master
  set
    drug_name = trim(v_pending.proposed_data ->> 'drug_name'),
    medication_type = trim(coalesce(v_pending.proposed_data ->> 'medication_type', v_previous.medication_type)),
    frequency = nullif(trim(coalesce(v_pending.proposed_data ->> 'frequency', v_previous.frequency, '')), ''),
    tolerability_less = nullif(trim(coalesce(v_pending.proposed_data ->> 'tolerability_less', v_previous.tolerability_less, '')), ''),
    tolerability_more = nullif(trim(coalesce(v_pending.proposed_data ->> 'tolerability_more', v_previous.tolerability_more, '')), ''),
    safety = nullif(trim(coalesce(v_pending.proposed_data ->> 'safety', v_previous.safety, '')), ''),
    cost = nullif(trim(coalesce(v_pending.proposed_data ->> 'cost', v_previous.cost, '')), ''),
    line_of_treatment = (v_pending.proposed_data ->> 'line_of_treatment')::integer,
    initiation_dose_mg = (v_pending.proposed_data ->> 'initiation_dose_mg')::integer,
    therapeutic_min_dose_mg = (v_pending.proposed_data ->> 'therapeutic_min_dose_mg')::integer,
    therapeutic_max_dose_mg = (v_pending.proposed_data ->> 'therapeutic_max_dose_mg')::integer,
    max_dose_mg = (v_pending.proposed_data ->> 'max_dose_mg')::integer,
    is_active = coalesce((v_pending.proposed_data ->> 'is_active')::boolean, v_previous.is_active)
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
      v_previous.medication_type,
      v_previous.frequency,
      v_previous.tolerability_less,
      v_previous.tolerability_more,
      v_previous.safety,
      v_previous.cost,
      v_previous.line_of_treatment,
      v_previous.initiation_dose_mg,
      v_previous.therapeutic_min_dose_mg,
      v_previous.therapeutic_max_dose_mg,
      v_previous.max_dose_mg,
      v_previous.is_active
    ),
    public.antidepressant_snapshot(
      v_updated.drug_name,
      v_updated.medication_type,
      v_updated.frequency,
      v_updated.tolerability_less,
      v_updated.tolerability_more,
      v_updated.safety,
      v_updated.cost,
      v_updated.line_of_treatment,
      v_updated.initiation_dose_mg,
      v_updated.therapeutic_min_dose_mg,
      v_updated.therapeutic_max_dose_mg,
      v_updated.max_dose_mg,
      v_updated.is_active
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

drop function if exists public.delete_antidepressant_with_audit(uuid, text);
drop function if exists public.submit_antidepressant_pending_delete(uuid, text);

create or replace function public.delete_antidepressant_with_audit(
  p_drug_id uuid,
  p_change_reason text
)
returns public.antidepressant_master
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.antidepressant_master%rowtype;
  v_deleted public.antidepressant_master%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_treatment_admin() then
    raise exception 'Only super admins can delete antidepressant master data';
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

  if not v_previous.is_active then
    raise exception 'Drug entry is already deleted';
  end if;

  update public.antidepressant_master
  set
    is_active = false
  where id = p_drug_id
  returning *
  into v_deleted;

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
      v_previous.medication_type,
      v_previous.frequency,
      v_previous.tolerability_less,
      v_previous.tolerability_more,
      v_previous.safety,
      v_previous.cost,
      v_previous.line_of_treatment,
      v_previous.initiation_dose_mg,
      v_previous.therapeutic_min_dose_mg,
      v_previous.therapeutic_max_dose_mg,
      v_previous.max_dose_mg,
      v_previous.is_active
    ),
    public.antidepressant_snapshot(
      v_deleted.drug_name,
      v_deleted.medication_type,
      v_deleted.frequency,
      v_deleted.tolerability_less,
      v_deleted.tolerability_more,
      v_deleted.safety,
      v_deleted.cost,
      v_deleted.line_of_treatment,
      v_deleted.initiation_dose_mg,
      v_deleted.therapeutic_min_dose_mg,
      v_deleted.therapeutic_max_dose_mg,
      v_deleted.max_dose_mg,
      v_deleted.is_active
    ),
    trim(p_change_reason)
  );

  return v_deleted;
end;
$$;

create or replace function public.submit_antidepressant_pending_delete(
  p_drug_id uuid,
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

  if not v_previous.is_active then
    raise exception 'Drug entry is already deleted';
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
      v_previous.medication_type,
      v_previous.frequency,
      v_previous.tolerability_less,
      v_previous.tolerability_more,
      v_previous.safety,
      v_previous.cost,
      v_previous.line_of_treatment,
      v_previous.initiation_dose_mg,
      v_previous.therapeutic_min_dose_mg,
      v_previous.therapeutic_max_dose_mg,
      v_previous.max_dose_mg,
      v_previous.is_active
    ),
    public.antidepressant_snapshot(
      v_previous.drug_name,
      v_previous.medication_type,
      v_previous.frequency,
      v_previous.tolerability_less,
      v_previous.tolerability_more,
      v_previous.safety,
      v_previous.cost,
      v_previous.line_of_treatment,
      v_previous.initiation_dose_mg,
      v_previous.therapeutic_min_dose_mg,
      v_previous.therapeutic_max_dose_mg,
      v_previous.max_dose_mg,
      false
    ),
    trim(p_change_reason)
  )
  returning *
  into v_pending;

  return v_pending;
end;
$$;

grant execute on function public.delete_antidepressant_with_audit(uuid, text) to authenticated;
grant execute on function public.submit_antidepressant_pending_delete(uuid, text) to authenticated;
