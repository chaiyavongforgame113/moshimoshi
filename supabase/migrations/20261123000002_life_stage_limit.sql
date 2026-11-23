-- Keep the database limit aligned with LIFE_STAGE_MAX.
create or replace function private.life_stages_ok(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null or (
    cardinality(p) <= 6
    and not exists (
      select 1 from unnest(p) as x(v)
      where x.v is null or char_length(x.v) not between 1 and 40 or x.v <> btrim(x.v)
    )
    and (select count(distinct x.v) from unnest(p) as x(v)) = cardinality(p)
  );
$$;
