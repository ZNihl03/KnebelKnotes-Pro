alter table public.categories
  add column if not exists titration_schedule text;
