alter table public.pending_antidepressant_edits
  alter column drug_id drop not null;

drop function if exists public.submit_antidepressant_pending_add(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text
);

create or replace function public.submit_antidepressant_pending_add(
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

  if not public.is_treatment_editor() then
    raise exception 'Only treatment editors can submit change proposals';
  end if;

  if trim(coalesce(p_medication_type, '')) = '' then
    raise exception 'Medication type is required';
  end if;

  if trim(coalesce(p_change_reason, '')) = '' then
    raise exception 'Change reason is required';
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
    null,
    p_category_id,
    auth.uid(),
    '{}'::jsonb,
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
      true
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

  if v_pending.drug_id is null then
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
      max_dose_mg,
      is_active
    )
    values (
      v_pending.category_id,
      trim(v_pending.proposed_data ->> 'drug_name'),
      trim(v_pending.proposed_data ->> 'medication_type'),
      nullif(trim(coalesce(v_pending.proposed_data ->> 'frequency', '')), ''),
      nullif(trim(coalesce(v_pending.proposed_data ->> 'tolerability_less', '')), ''),
      nullif(trim(coalesce(v_pending.proposed_data ->> 'tolerability_more', '')), ''),
      nullif(trim(coalesce(v_pending.proposed_data ->> 'safety', '')), ''),
      nullif(trim(coalesce(v_pending.proposed_data ->> 'cost', '')), ''),
      (v_pending.proposed_data ->> 'line_of_treatment')::integer,
      (v_pending.proposed_data ->> 'initiation_dose_mg')::integer,
      (v_pending.proposed_data ->> 'therapeutic_min_dose_mg')::integer,
      (v_pending.proposed_data ->> 'therapeutic_max_dose_mg')::integer,
      (v_pending.proposed_data ->> 'max_dose_mg')::integer,
      coalesce((v_pending.proposed_data ->> 'is_active')::boolean, true)
    )
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
      v_updated.id,
      auth.uid(),
      '{}'::jsonb,
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
  else
    select *
    into v_previous
    from public.antidepressant_master
    where id = v_pending.drug_id
    for update;

    if not found then
      raise exception 'Drug entry not found';
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
  end if;

  update public.pending_antidepressant_edits
  set
    drug_id = coalesce(v_pending.drug_id, v_updated.id),
    status = 'approved',
    review_note = nullif(trim(coalesce(p_review_note, '')), ''),
    reviewed_by_user_id = auth.uid(),
    reviewed_at = timezone('utc', now())
  where id = v_pending.id;

  return v_updated;
end;
$$;

grant execute on function public.submit_antidepressant_pending_add(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text
) to authenticated;
