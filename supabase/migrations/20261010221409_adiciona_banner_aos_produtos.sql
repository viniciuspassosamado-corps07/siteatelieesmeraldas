-- Exportada do histórico de migrations do banco (supabase_migrations.schema_migrations), sem alterações.
-- Aplicada em 2026-10-10.

alter table public.produtos
  add column no_banner boolean not null default false,
  add column foto_banner text;

alter table public.produtos
  add constraint produtos_foto_banner_ok
  check (foto_banner is null or public.fotos_validas(array[foto_banner]));

-- mantém o visual de hoje: as 5 ofertas de exemplo ficam marcadas no banner
update public.produtos set no_banner = true where oferta and nome like '%(exemplo)';
