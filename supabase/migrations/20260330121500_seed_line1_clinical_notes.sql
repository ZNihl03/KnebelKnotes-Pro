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
    tolerability_less,
    tolerability_more,
    safety,
    cost
  ) as (
    values
      ('Citalopram', '↓ Sedation', '↑ Sexual dysfunction', 'QT prolongation; ↓ drug interaction', 'Low'),
      ('Escitalopram', '↓ Sedation; ↓ Weight gain', '↑ Sexual dysfunction', 'QT prolongation; ↓ drug interaction', 'Low'),
      ('Fluoxetine', '↓ Sedation; ↓ Weight gain; ↓ D/C syndrome', null, 'Not recommended in elderly; ↑ drug interaction', 'Low'),
      ('Fluvoxamine', '↓ Sedation; ↓ Weight gain', '↑ agitation; ↑ GI distress', '↑ drug interaction', 'Low'),
      ('Paroxetine', null, '↑ Weight gain; ↑ Sexual dysfunction; ↑ D/C syndrome', '↑ drug interaction', 'Low'),
      ('Sertraline', '↓ Sedation', '↑ GI distress', null, 'Low'),
      ('Desvenlafaxine', '↓ Sedation; ↓ Weight gain; ↓ Sexual dysfunction', null, '↓ drug interaction', 'Moderate-High'),
      ('Duloxetine', '↓ Sedation', '↑ Sexual dysfunction; ↑ nausea', null, 'Low'),
      ('Levomilnacipran', '↓ Sedation; ↓ Weight gain', '↑ nausea', '↓ drug interaction', 'High'),
      ('Venlafaxine XR', '↓ Sedation', '↟ nausea; ↑ Sweating; ↑ D/C syndrome; ↑ Sexual dysfunction', 'Increased HR and BP', 'Low'),
      ('Bupropion XL/SR', '↓ Sedation; ↓ Weight gain; ↓ Sexual dysfunction; ↓ D/C syndrome; ↓ appetite', '↑ activating', '↓ seizure threshold', 'Low'),
      ('Mirtazapine', '↓ Sexual dysfunction; ↓ D/C syndrome', '↟ appetite; ↑ sedation; ↑ Weight gain', '↓ drug interaction', 'Low'),
      ('Vilazodone', '↓ Sedation', '↟ GI distress; ↑ nausea', '↓ drug interaction', 'High'),
      ('Vortioxetine', '↓ Sedation; ↓ Weight gain; ↓ Sexual dysfunction', null, '↓ drug interaction', 'High'),
      ('Agomelatine', '↓ Weight gain; ↓ Sexual dysfunction', null, '↓ drug interaction; monitor LFTs', 'Moderate'),
      ('Mianserin', null, '↑ Sedation', '↓ drug interaction', 'N/A'),
      ('Milnacipran', '↓ Sedation', '↑ nausea', '↓ drug interaction', 'N/A')
  )
  update public.antidepressant_master as target
  set
    tolerability_less = source.tolerability_less,
    tolerability_more = source.tolerability_more,
    safety = source.safety,
    cost = source.cost
  from source
  where target.category_id = v_category_id
    and target.line_of_treatment = 1
    and target.medication_type = 'monotherapy'
    and target.drug_name = source.drug_name;
end;
$$;
