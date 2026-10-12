-- Exportada do histórico de migrations do banco (supabase_migrations.schema_migrations), sem alterações.
-- Aplicada em 2026-10-10.

-- B1: privilégios mínimos
revoke all on table public.produtos from anon, authenticated;
grant select on public.produtos to anon;
grant select, insert, update, delete on public.produtos to authenticated;
revoke all on table public.admins from anon, authenticated;
grant select on public.admins to authenticated;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.produtos_atualizado_em() from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- B2: validação no servidor
create or replace function public.fotos_validas(f text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(f),0) <= 8
     and not exists (select 1 from unnest(f) x
          where x is null or x like '%..%'
             or x !~ '^[A-Za-z0-9][A-Za-z0-9_./-]{0,180}\.(webp|jpe?g|png)$')
$$;

alter table public.produtos
  add constraint produtos_nome_trim     check (char_length(btrim(nome)) >= 1),
  add constraint produtos_titulo_len    check (titulo    is null or char_length(titulo)    <= 160),
  add constraint produtos_descricao_len check (descricao is null or char_length(descricao) <= 2000),
  add constraint produtos_detalhes_len  check (detalhes  is null or char_length(detalhes)  <= 160),
  add constraint produtos_preco_pos     check (preco is null or preco > 0),
  add constraint produtos_estoque_max   check (estoque <= 100000),
  add constraint produtos_fotos_ok      check (public.fotos_validas(fotos));
