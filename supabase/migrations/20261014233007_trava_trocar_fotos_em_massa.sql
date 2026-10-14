-- Trava contra troca de fotos em massa (complementa a trava de DELETE de 20261012040000).
-- Motivo: um único UPDATE que esvazie ou troque as fotos de muitos produtos dispara a limpeza
-- automática em cada linha, e a Edge Function apaga os arquivos do bucket para sempre
-- (o Storage não entra em nenhum backup).
--
-- Regra: um comando que mude "fotos" ou "foto_banner" de mais de 3 produtos é recusado e desfeito
-- por inteiro, inclusive os avisos de limpeza (o pg_net só envia o que foi confirmado).
-- Só conta produto cujas fotos mudaram de verdade: esconder, reordenar ou mudar preço de vários
-- produtos de uma vez continua liberado. Troca de id conta como mudança.
-- Vale também para upsert (INSERT ... ON CONFLICT DO UPDATE) e MERGE.
--
-- Válvula de escape: a mesma da trava de DELETE, só no SQL Editor (a API não consegue usá-la):
--   begin;
--   set local app.apagar_em_massa = 'sim';
--   update public.produtos set ... where ...;
--   commit;

create or replace function public.produtos_trava_trocar_fotos_em_massa()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_limite constant int := 3;
  v_qtd bigint;
begin
  if coalesce(current_setting('app.apagar_em_massa', true), '') = 'sim'
     and current_user not in ('anon', 'authenticated', 'service_role') then
    return null;
  end if;

  select count(*) into v_qtd
  from novos n
  left join antigos o on o.id = n.id
  where o.id is null
     or o.fotos is distinct from n.fotos
     or o.foto_banner is distinct from n.foto_banner;

  if v_qtd > v_limite then
    raise exception 'Bloqueado: este comando trocaria as fotos de % produtos de uma vez (o limite é %)', v_qtd, v_limite
      using errcode = 'P0001',
            hint = 'Edite um produto por vez pelo painel. Para trocar de propósito, use o SQL Editor com: begin; set local app.apagar_em_massa = ''sim''; ...; commit;';
  end if;

  return null;
end;
$$;

-- a função da trava não pode ser chamada pelo navegador
revoke execute on function public.produtos_trava_trocar_fotos_em_massa() from public, anon, authenticated;

-- uma vez por comando; sem lista de colunas porque o Postgres não aceita tabelas de transição com ela
drop trigger if exists produtos_trava_trocar_fotos_em_massa on public.produtos;
create trigger produtos_trava_trocar_fotos_em_massa
  after update on public.produtos
  referencing old table as antigos new table as novos
  for each statement execute function public.produtos_trava_trocar_fotos_em_massa();

-- Para desfazer:
--   drop trigger if exists produtos_trava_trocar_fotos_em_massa on public.produtos;
--   drop function if exists public.produtos_trava_trocar_fotos_em_massa();
