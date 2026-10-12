-- Trava contra apagamento em massa de produtos.
-- Um único comando DELETE que apague mais de 3 produtos é recusado e desfeito por inteiro
-- (inclusive os avisos de limpeza de fotos, que só saem quando a transação é confirmada).
-- TRUNCATE em produtos também é recusado.
--
-- Vale para todos: navegador (anon/authenticated), service_role e SQL Editor.
-- O painel /admin apaga um produto por vez (form.js: delete().eq('id', ...)), então não é afetado.
--
-- Válvula de escape, só para quem tem acesso ao SQL Editor (a API não consegue mudar esta configuração):
--   begin;
--   set local app.apagar_em_massa = 'sim';
--   delete from public.produtos where ...;
--   commit;
-- Mesmo com a válvula, anon, authenticated e service_role continuam travados.

create or replace function public.produtos_trava_apagar_em_massa()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_limite constant int := 3;
  v_qtd bigint;
  v_liberado boolean :=
    coalesce(current_setting('app.apagar_em_massa', true), '') = 'sim'
    and current_user not in ('anon', 'authenticated', 'service_role');
begin
  if v_liberado then
    return null;
  end if;

  if tg_op = 'TRUNCATE' then
    raise exception 'TRUNCATE em produtos está bloqueado (trava contra apagamento em massa)'
      using errcode = 'P0001',
            hint = 'Para apagar de propósito, use o SQL Editor com: begin; set local app.apagar_em_massa = ''sim''; ...; commit;';
  end if;

  select count(*) into v_qtd from apagados;
  if v_qtd > v_limite then
    raise exception 'Bloqueado: este comando apagaria % produtos de uma vez (o limite é %)', v_qtd, v_limite
      using errcode = 'P0001',
            hint = 'Apague um produto por vez pelo painel. Para apagar de propósito, use o SQL Editor com: begin; set local app.apagar_em_massa = ''sim''; ...; commit;';
  end if;

  return null;
end;
$$;

-- a função da trava não pode ser chamada pelo navegador
revoke execute on function public.produtos_trava_apagar_em_massa() from public, anon, authenticated;

-- conta as linhas apagadas pelo comando inteiro (uma vez por comando, não por linha)
drop trigger if exists produtos_trava_apagar_em_massa on public.produtos;
create trigger produtos_trava_apagar_em_massa
  after delete on public.produtos
  referencing old table as apagados
  for each statement execute function public.produtos_trava_apagar_em_massa();

drop trigger if exists produtos_trava_truncate on public.produtos;
create trigger produtos_trava_truncate
  before truncate on public.produtos
  for each statement execute function public.produtos_trava_apagar_em_massa();

-- Para desfazer:
--   drop trigger if exists produtos_trava_apagar_em_massa on public.produtos;
--   drop trigger if exists produtos_trava_truncate on public.produtos;
--   drop function if exists public.produtos_trava_apagar_em_massa();
