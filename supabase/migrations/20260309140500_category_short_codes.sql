create extension if not exists pgcrypto;

create or replace function public.generate_category_short_code()
returns text
language plpgsql
volatile
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_candidate text;
  v_index integer;
begin
  loop
    v_candidate := '';

    for v_index in 1..5 loop
      v_candidate := v_candidate || substr(v_alphabet, (get_byte(gen_random_bytes(1), 0) % length(v_alphabet)) + 1, 1);
    end loop;

    if not exists (
      select 1
      from public.categories
      where short_code = v_candidate
    ) then
      return v_candidate;
    end if;
  end loop;
end;
$$;

alter table public.categories
  add column if not exists short_code text;

do $$
declare
  v_category_id uuid;
begin
  for v_category_id in
    select id
    from public.categories
    where short_code is null or btrim(short_code) = ''
  loop
    update public.categories
    set short_code = public.generate_category_short_code()
    where id = v_category_id;
  end loop;
end;
$$;

alter table public.categories
  alter column short_code set default public.generate_category_short_code();

alter table public.categories
  alter column short_code set not null;

create unique index if not exists categories_short_code_key
  on public.categories (short_code);
