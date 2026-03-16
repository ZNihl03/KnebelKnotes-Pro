alter table public.categories
  add column if not exists assessment_initial_response text,
  add column if not exists assessment_change_treatment text,
  add column if not exists assessment_dose_optimization text;
