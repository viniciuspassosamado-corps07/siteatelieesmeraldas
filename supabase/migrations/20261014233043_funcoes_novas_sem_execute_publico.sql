-- Funções novas deixam de nascer chamáveis pelo navegador.
--
-- O "alter default privileges ... in schema public revoke execute on functions from public" de
-- 20261010215211 não tinha efeito: o EXECUTE para PUBLIC é um padrão GLOBAL do Postgres, e uma regra
-- por schema só consegue acrescentar permissões, nunca tirar as globais. Prova: fotos_validas, criada
-- depois daquela migration, respondia 200 em /rest/v1/rpc/fotos_validas para o visitante (anon).
--
-- A partir daqui, toda função criada pelo postgres nasce só com postgres e service_role
-- (a regra do schema public acrescenta service_role). Quem precisar chamar uma função nova
-- tem de receber "grant execute" explícito, como já fazemos em is_admin e foto_esta_em_uso.
alter default privileges for role postgres revoke execute on functions from public;

-- fotos_validas: o visitante não precisa dela. O authenticated precisa, porque os CHECKs de
-- produtos (produtos_fotos_ok e produtos_foto_banner_ok) a executam quando o admin salva.
revoke execute on function public.fotos_validas(text[]) from public, anon;
grant execute on function public.fotos_validas(text[]) to authenticated, service_role;

-- Para desfazer:
--   alter default privileges for role postgres grant execute on functions to public;
--   grant execute on function public.fotos_validas(text[]) to public;
