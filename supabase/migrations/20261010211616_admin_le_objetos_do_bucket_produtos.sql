-- Exportada do histórico de migrations do banco (supabase_migrations.schema_migrations), sem alterações.
-- Aplicada em 2026-10-10.

-- Necessária para o admin listar e remover arquivos do bucket (a leitura pública das fotos continua pela URL pública).
create policy "admin le fotos"
  on storage.objects for select to authenticated
  using (bucket_id = 'produtos' and public.is_admin());
