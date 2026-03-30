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
      ('Amitriptyline', null, '↟ anticholinergic; ↟ weight gain; ↑ sedation; ↑ orthostatic hypotension; ↑ sexual dysfunction', 'Cardiotoxic in OD; QT prolongation', 'Low'),
      ('Clomipramine', null, '↟ anticholinergic; ↟ sexual dysfunction; ↑ sedation; ↑ weight gain; ↑ nausea', 'Cardiotoxic in OD; QT prolongation; ↓ seizure threshold', 'Low'),
      ('Desipramine', '↓ sedation; ↓ anticholinergic (vs other TCAs)', '↑ activating', 'Cardiotoxic in OD; QT prolongation', 'Low-Moderate'),
      ('Doxepin', '↓ insomnia', '↟ sedation; ↑ anticholinergic; ↑ weight gain', 'Cardiotoxic in OD', 'Low'),
      ('Imipramine', null, '↟ orthostatic hypotension; ↑ sedation; ↑ anticholinergic; ↑ weight gain', 'Cardiotoxic in OD; QT prolongation', 'Low'),
      ('Nortriptyline', '↓ anticholinergic (vs other TCAs); ↓ orthostatic hypotension (vs other TCAs)', '↑ sedation', 'Cardiotoxic in overdose; QT prolongation; safest TCA in elderly', 'Low'),
      ('Protriptyline', '↓ sedation', '↑ activating; ↑ anticholinergic', 'Cardiotoxic in overdose; QT prolongation', 'Moderate-High'),
      ('Trimipramine', '↓ insomnia', '↑ sedation; ↑ anticholinergic; ↑ weight gain', 'Cardiotoxic in overdose', 'Low-Moderate'),
      ('Moclobemide', '↓ sedation; ↓ weight gain; ↓ sexual dysfunction; ↓ anticholinergic', '↑ insomnia; ↑ nausea', 'Tyramine interaction at doses >600 mg; serotonin syndrome risk with serotonergic agents', 'Low'),
      ('Trazodone', '↓ sexual dysfunction; ↓ weight gain', '↑ sedation; ↑ orthostatic hypotension', 'Priapism (rare); QT prolongation', 'Low'),
      ('Quetiapine', '↓ drug interactions; ↓ akathisia', '↑ sedation; ↑ metabolic risk; ↑ weight gain', 'QT prolongation', 'Low'),
      ('Dextromethorphan-bupropion', '↓ sedation; ↓ weight gain; ↓ sexual dysfunction', '↑ dizziness; ↑ nausea', 'Seizure risk; serotonin syndrome risk', 'Very high'),
      ('Nefazodone', '↓ sexual dysfunction; ↓ insomnia', '↑ sedation', '↟ hepatotoxicity (black box warning); monitor LFTs', 'Low-Moderate'),
      ('Selegiline transdermal', '↓ sexual dysfunction; ↓ weight gain', '↑ application site reactions; ↑ insomnia', 'Tyramine interaction at doses >6 mg/24h; serotonin syndrome risk with serotonergic agents', 'Very high'),
      ('Phenelzine', null, '↟ orthostatic hypotension; ↑ weight gain; ↑ sexual dysfunction; ↑ sedation', '↟ drug interactions; tyramine interaction (hypertensive crisis); serotonin syndrome', 'Low-Moderate'),
      ('Tranylcypromine', '↓ sedation (more activating MAOI); ↓ weight gain (vs phenelzine)', '↟ activating; ↑ insomnia; ↑ orthostatic hypotension', '↟ drug interactions; tyramine interaction (hypertensive crisis); serotonin syndrome', 'Low-Moderate'),
      ('Reboxetine', '↓ sedation; ↓ sexual dysfunction', '↑ activating; ↑ insomnia; ↑ sweating; ↑ dry mouth; ↑ urinary hesitancy', '↓ drug interactions', 'N/A')
  )
  update public.antidepressant_master as target
  set
    tolerability_less = source.tolerability_less,
    tolerability_more = source.tolerability_more,
    safety = source.safety,
    cost = source.cost
  from source
  where target.category_id = v_category_id
    and target.line_of_treatment in (2, 3)
    and target.medication_type = 'monotherapy'
    and target.drug_name = source.drug_name;
end;
$$;
