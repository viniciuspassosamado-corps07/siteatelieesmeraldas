-- Exportada do histórico de migrations do banco (supabase_migrations.schema_migrations), sem alterações.
-- Aplicada em 2026-10-11. O segredo é lido do Vault: nenhum valor fica neste arquivo.

-- confere o segredo recebido pela Edge Function (compara os hashes)
create or replace function public.limpar_fotos_segredo_ok(s text)
returns boolean language sql security definer set search_path = '' stable as $$
  select coalesce(s, '') <> '' and exists (
    select 1 from vault.decrypted_secrets d
    where d.name = 'limpar_fotos_segredo'
      and extensions.digest(d.decrypted_secret, 'sha256') = extensions.digest(s, 'sha256')
  );
$$;

-- todos os caminhos que algum produto ainda usa (foto, miniatura e banner)
create or replace function public.fotos_em_uso()
returns text[] language sql security definer set search_path = '' stable as $$
  select coalesce(array_agg(distinct x), '{}')
  from (
    select unnest(fotos) as x from public.produtos
    union all select regexp_replace(f, '(\.\w+)$', '-thumb\1') from public.produtos, unnest(fotos) f
    union all select foto_banner from public.produtos
  ) t
  where x is not null;
$$;

-- chama a Edge Function (assíncrono, via pg_net) com o segredo do Vault
create or replace function public.limpar_fotos_chamar(p_corpo jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_segredo text;
  v_id bigint;
begin
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'limpar_fotos_segredo';
  if v_segredo is null then
    raise exception 'segredo da limpeza ausente no Vault';
  end if;
  select net.http_post(
    url := 'https://vcunrbzfinnnyjviwlag.supabase.co/functions/v1/limpar-fotos',
    body := p_corpo,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-limpeza-segredo', v_segredo),
    timeout_milliseconds := 20000
  ) into v_id;
  return v_id;
end;
$$;

revoke execute on function public.limpar_fotos_segredo_ok(text), public.fotos_em_uso(), public.limpar_fotos_chamar(jsonb)
  from public, anon, authenticated;
grant execute on function public.limpar_fotos_segredo_ok(text), public.fotos_em_uso() to service_role;
