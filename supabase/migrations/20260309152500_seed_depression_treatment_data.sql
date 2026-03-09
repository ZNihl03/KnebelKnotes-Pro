do $$
declare
  v_category_id uuid;
begin
  select id
  into v_category_id
  from public.categories
  where short_code = 'QAZ4C';

  if not found then
    raise exception 'Depression category with short code QAZ4C was not found.';
  end if;

  with source (
    line_of_treatment,
    medication_type,
    drug_name,
    initiation_dose_mg,
    therapeutic_min_dose_mg,
    therapeutic_max_dose_mg,
    max_dose_mg,
    frequency
  ) as (
    values
      (1, 'monotherapy', 'Citalopram', 20, 20, 40, 40, 'daily'),
      (1, 'monotherapy', 'Escitalopram', 10, 10, 20, 20, 'daily'),
      (1, 'monotherapy', 'Fluoxetine', 20, 20, 60, 80, 'daily'),
      (1, 'monotherapy', 'Fluvoxamine', 50, 100, 300, 300, 'daily'),
      (1, 'monotherapy', 'Paroxetine', 20, 20, 50, 50, 'daily'),
      (1, 'monotherapy', 'Sertraline', 50, 50, 200, 200, 'daily'),
      (1, 'monotherapy', 'Desvenlafaxine', 50, 50, 100, 100, 'daily'),
      (1, 'monotherapy', 'Duloxetine', 30, 60, 120, 120, 'daily'),
      (1, 'monotherapy', 'Levomilnacipran', 20, 40, 120, 120, 'daily'),
      (1, 'monotherapy', 'Venlafaxine XR', 75, 75, 225, 225, 'daily'),
      (1, 'monotherapy', 'Bupropion XL/SR', 150, 150, 300, 450, 'daily'),
      (1, 'monotherapy', 'Mirtazapine', 15, 15, 45, 45, 'nightly'),
      (1, 'monotherapy', 'Vilazodone', 10, 20, 40, 40, 'daily'),
      (1, 'monotherapy', 'Vortioxetine', 10, 10, 20, 20, 'daily'),
      (1, 'monotherapy', 'Agomelatine', 25, 25, 50, 50, 'nightly'),
      (1, 'monotherapy', 'Mianserin', 30, 30, 90, 90, 'nightly'),
      (1, 'monotherapy', 'Milnacipran', 50, 50, 100, 200, 'BID'),
      (2, 'monotherapy', 'Amitriptyline', 25, 75, 150, 300, 'nightly'),
      (2, 'monotherapy', 'Clomipramine', 25, 100, 250, 250, 'nightly'),
      (2, 'monotherapy', 'Desipramine', 50, 100, 200, 300, 'daily'),
      (2, 'monotherapy', 'Doxepin', 25, 75, 150, 300, 'nightly'),
      (2, 'monotherapy', 'Imipramine', 25, 75, 150, 300, 'nightly'),
      (2, 'monotherapy', 'Nortriptyline', 25, 75, 150, 150, 'nightly'),
      (2, 'monotherapy', 'Protriptyline', 10, 20, 40, 40, 'daily'),
      (2, 'monotherapy', 'Trimipramine', 25, 75, 150, 300, 'nightly'),
      (2, 'monotherapy', 'Moclobemide', 300, 300, 600, 600, 'BID'),
      (2, 'monotherapy', 'Trazodone', 50, 150, 400, 600, 'nightly'),
      (2, 'monotherapy', 'Quetiapine', 50, 150, 300, 800, 'nightly'),
      (2, 'monotherapy', 'Dextromethorphan-bupropion', 45, 45, 105, 210, 'daily'),
      (2, 'monotherapy', 'Nefazodone', 200, 200, 600, 600, 'BID'),
      (2, 'monotherapy', 'Selegiline transdermal', 6, 6, 12, 12, '24h patch'),
      (3, 'monotherapy', 'Phenelzine', null, null, null, null, null),
      (3, 'monotherapy', 'Tranylcypromine', null, null, null, null, null),
      (3, 'monotherapy', 'Reboxetine', null, null, null, null, null)
  )
  update public.antidepressant_master as target
  set
    medication_type = source.medication_type,
    frequency = source.frequency,
    line_of_treatment = source.line_of_treatment,
    initiation_dose_mg = source.initiation_dose_mg,
    therapeutic_min_dose_mg = source.therapeutic_min_dose_mg,
    therapeutic_max_dose_mg = source.therapeutic_max_dose_mg,
    max_dose_mg = source.max_dose_mg,
    is_active = true
  from source
  where target.category_id = v_category_id
    and target.drug_name = source.drug_name;

  with source (
    line_of_treatment,
    medication_type,
    drug_name,
    initiation_dose_mg,
    therapeutic_min_dose_mg,
    therapeutic_max_dose_mg,
    max_dose_mg,
    frequency
  ) as (
    values
      (1, 'monotherapy', 'Citalopram', 20, 20, 40, 40, 'daily'),
      (1, 'monotherapy', 'Escitalopram', 10, 10, 20, 20, 'daily'),
      (1, 'monotherapy', 'Fluoxetine', 20, 20, 60, 80, 'daily'),
      (1, 'monotherapy', 'Fluvoxamine', 50, 100, 300, 300, 'daily'),
      (1, 'monotherapy', 'Paroxetine', 20, 20, 50, 50, 'daily'),
      (1, 'monotherapy', 'Sertraline', 50, 50, 200, 200, 'daily'),
      (1, 'monotherapy', 'Desvenlafaxine', 50, 50, 100, 100, 'daily'),
      (1, 'monotherapy', 'Duloxetine', 30, 60, 120, 120, 'daily'),
      (1, 'monotherapy', 'Levomilnacipran', 20, 40, 120, 120, 'daily'),
      (1, 'monotherapy', 'Venlafaxine XR', 75, 75, 225, 225, 'daily'),
      (1, 'monotherapy', 'Bupropion XL/SR', 150, 150, 300, 450, 'daily'),
      (1, 'monotherapy', 'Mirtazapine', 15, 15, 45, 45, 'nightly'),
      (1, 'monotherapy', 'Vilazodone', 10, 20, 40, 40, 'daily'),
      (1, 'monotherapy', 'Vortioxetine', 10, 10, 20, 20, 'daily'),
      (1, 'monotherapy', 'Agomelatine', 25, 25, 50, 50, 'nightly'),
      (1, 'monotherapy', 'Mianserin', 30, 30, 90, 90, 'nightly'),
      (1, 'monotherapy', 'Milnacipran', 50, 50, 100, 200, 'BID'),
      (2, 'monotherapy', 'Amitriptyline', 25, 75, 150, 300, 'nightly'),
      (2, 'monotherapy', 'Clomipramine', 25, 100, 250, 250, 'nightly'),
      (2, 'monotherapy', 'Desipramine', 50, 100, 200, 300, 'daily'),
      (2, 'monotherapy', 'Doxepin', 25, 75, 150, 300, 'nightly'),
      (2, 'monotherapy', 'Imipramine', 25, 75, 150, 300, 'nightly'),
      (2, 'monotherapy', 'Nortriptyline', 25, 75, 150, 150, 'nightly'),
      (2, 'monotherapy', 'Protriptyline', 10, 20, 40, 40, 'daily'),
      (2, 'monotherapy', 'Trimipramine', 25, 75, 150, 300, 'nightly'),
      (2, 'monotherapy', 'Moclobemide', 300, 300, 600, 600, 'BID'),
      (2, 'monotherapy', 'Trazodone', 50, 150, 400, 600, 'nightly'),
      (2, 'monotherapy', 'Quetiapine', 50, 150, 300, 800, 'nightly'),
      (2, 'monotherapy', 'Dextromethorphan-bupropion', 45, 45, 105, 210, 'daily'),
      (2, 'monotherapy', 'Nefazodone', 200, 200, 600, 600, 'BID'),
      (2, 'monotherapy', 'Selegiline transdermal', 6, 6, 12, 12, '24h patch'),
      (3, 'monotherapy', 'Phenelzine', null, null, null, null, null),
      (3, 'monotherapy', 'Tranylcypromine', null, null, null, null, null),
      (3, 'monotherapy', 'Reboxetine', null, null, null, null, null)
  )
  insert into public.antidepressant_master (
    category_id,
    drug_name,
    medication_type,
    frequency,
    line_of_treatment,
    initiation_dose_mg,
    therapeutic_min_dose_mg,
    therapeutic_max_dose_mg,
    max_dose_mg,
    is_active
  )
  select
    v_category_id,
    source.drug_name,
    source.medication_type,
    source.frequency,
    source.line_of_treatment,
    source.initiation_dose_mg,
    source.therapeutic_min_dose_mg,
    source.therapeutic_max_dose_mg,
    source.max_dose_mg,
    true
  from source
  where not exists (
    select 1
    from public.antidepressant_master target
    where target.category_id = v_category_id
      and target.drug_name = source.drug_name
  );
end;
$$;
