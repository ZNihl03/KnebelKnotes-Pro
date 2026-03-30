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
    drug_name,
    frequency,
    initiation_dose_mg,
    therapeutic_min_dose_mg,
    therapeutic_max_dose_mg,
    max_dose_mg
  ) as (
    values
      ('Desipramine', 'daily', 25, 100, 200, 300),
      ('Moclobemide', 'BID', 150, 300, 600, 600),
      ('Nefazodone', 'BID', 100, 200, 600, 600),
      ('Phenelzine', 'orally 3 times daily', 15, 45, 90, 90),
      ('Tranylcypromine', 'daily (divided doses)', 10, 30, 60, 60),
      ('Reboxetine', 'twice daily', 4, 4, 10, 10)
  )
  update public.antidepressant_master as target
  set
    frequency = source.frequency,
    initiation_dose_mg = source.initiation_dose_mg,
    therapeutic_min_dose_mg = source.therapeutic_min_dose_mg,
    therapeutic_max_dose_mg = source.therapeutic_max_dose_mg,
    max_dose_mg = source.max_dose_mg
  from source
  where target.category_id = v_category_id
    and target.medication_type = 'monotherapy'
    and target.drug_name = source.drug_name;
end;
$$;
