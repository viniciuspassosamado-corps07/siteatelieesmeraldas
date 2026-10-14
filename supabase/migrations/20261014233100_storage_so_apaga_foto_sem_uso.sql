-- Storage do bucket "produtos": menos poder para uma sessão de admin roubada.
--
-- 1) Apagar: o admin só apaga arquivo que NENHUM produto usa (foto, miniatura "-thumb" ou foto do banner).
--    Para sumir com uma foto, ela precisa sair do produto antes; aí a trava de fotos em massa e a de
--    DELETE valem também para o Storage. O painel já trabalha nessa ordem (form.js: grava o produto e
--    só depois remove as fotos antigas; ao apagar, apaga o produto e depois a pasta).
--    Arquivo ainda em uso é simplesmente ignorado pelo Storage (não dá erro).
-- 2) Enviar: só para a pasta de um produto, no formato <uuid>/<arquivo>.<webp|jpg|jpeg|png>,
--    o mesmo formato que a Edge Function limpar-fotos aceita. Nada fora disso fica esquecido no bucket.
-- 3) Sobrescrever: a política de UPDATE sai. O painel nunca sobrescreve (upload sem upsert);
--    sem ela, ninguém troca o conteúdo de uma foto já publicada.
--
-- A Edge Function limpar-fotos usa a service_role, que não passa pelo RLS: a limpeza continua igual.
-- A leitura pública das fotos (URL pública) e a listagem do admin ("admin le fotos") não mudam.

-- o arquivo está em uso por algum produto? (mesma regra de public.fotos_em_uso, usada pela Edge Function)
create or replace function public.foto_esta_em_uso(p_caminho text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.produtos p
    where p.foto_banner = p_caminho
       or p_caminho = any (p.fotos)
       or exists (select 1 from unnest(p.fotos) f where regexp_replace(f, '(\.\w+)$', '-thumb\1') = p_caminho)
  );
$$;
-- usada dentro da política, que roda com o papel de quem está logado
revoke execute on function public.foto_esta_em_uso(text) from public, anon;
grant execute on function public.foto_esta_em_uso(text) to authenticated, service_role;

drop policy if exists "admin remove fotos" on storage.objects;
drop policy if exists "admin remove fotos sem uso" on storage.objects;
create policy "admin remove fotos sem uso"
  on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and public.is_admin() and not public.foto_esta_em_uso(name));

drop policy if exists "admin envia fotos" on storage.objects;
drop policy if exists "admin envia fotos na pasta do produto" on storage.objects;
create policy "admin envia fotos na pasta do produto"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and public.is_admin()
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(webp|jpe?g|png)$'
  );

drop policy if exists "admin troca fotos" on storage.objects;

-- Para desfazer (volta às políticas de 20261010205411):
--   drop policy if exists "admin remove fotos sem uso" on storage.objects;
--   drop policy if exists "admin envia fotos na pasta do produto" on storage.objects;
--   create policy "admin remove fotos" on storage.objects for delete to authenticated
--     using (bucket_id = 'produtos' and public.is_admin());
--   create policy "admin envia fotos" on storage.objects for insert to authenticated
--     with check (bucket_id = 'produtos' and public.is_admin());
--   create policy "admin troca fotos" on storage.objects for update to authenticated
--     using (bucket_id = 'produtos' and public.is_admin())
--     with check (bucket_id = 'produtos' and public.is_admin());
--   drop function if exists public.foto_esta_em_uso(text);
