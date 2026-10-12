-- Exportada do histórico de migrations do banco (supabase_migrations.schema_migrations), sem alterações.
-- Aplicada em 2026-10-11. O segredo é gerado dentro do banco: nenhum valor fica neste arquivo.

create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'limpar_fotos_segredo',
  'Segredo compartilhado entre o banco e a Edge Function limpar-fotos'
)
where not exists (select 1 from vault.secrets where name = 'limpar_fotos_segredo');
