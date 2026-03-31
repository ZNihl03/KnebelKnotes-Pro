alter table public.categories
  add column if not exists assessment_antidepressant_switch text,
  add column if not exists assessment_antidepressant_augment text;
