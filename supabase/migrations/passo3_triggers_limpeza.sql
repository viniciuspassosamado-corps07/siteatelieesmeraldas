-- Passo 3: triggers que avisam a Edge Function "limpar-fotos" quando um produto é apagado
-- ou quando as fotos / a foto do banner mudam.
--
-- Pré-requisitos (já aplicados nos passos 1 e 2):
--   * extensão pg_net e segredo "limpar_fotos_segredo" no Vault
--   * funções public.limpar_fotos_segredo_ok, public.fotos_em_uso e public.limpar_fotos_chamar
--   * Edge Function "limpar-fotos" publicada (verify_jwt = false)
--
-- Nenhum segredo neste arquivo: a função limpar_fotos_chamar lê o segredo do Vault.

-- Função das triggers. O bloco interno captura QUALQUER erro (função fora do ar, segredo ausente,
-- pg_net indisponível) e só emite um aviso: o apagamento/a troca do produto nunca é travado.
-- A chamada é assíncrona (pg_net): a transação do produto não espera pela Edge Function.
create or replace function public.produtos_limpar_fotos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if tg_op = 'DELETE' then
      perform public.limpar_fotos_chamar(jsonb_build_object(
        'evento', 'DELETE', 'id', old.id,
        'antigo', jsonb_build_object('fotos', to_jsonb(old.fotos), 'foto_banner', old.foto_banner),
        'novo', null));
    else
      perform public.limpar_fotos_chamar(jsonb_build_object(
        'evento', 'UPDATE', 'id', new.id,
        'antigo', jsonb_build_object('fotos', to_jsonb(old.fotos), 'foto_banner', old.foto_banner),
        'novo', jsonb_build_object('fotos', to_jsonb(new.fotos), 'foto_banner', new.foto_banner)));
    end if;
  exception when others then
    raise warning 'limpar-fotos: nao foi possivel avisar a funcao (%)', sqlerrm;
  end;
  return null;
end;
$$;

-- a função das triggers não pode ser chamada pelo navegador
revoke execute on function public.produtos_limpar_fotos() from public, anon, authenticated;

-- produto apagado
drop trigger if exists produtos_limpar_fotos_apagar on public.produtos;
create trigger produtos_limpar_fotos_apagar
  after delete on public.produtos
  for each row execute function public.produtos_limpar_fotos();

-- fotos ou foto do banner trocadas (só dispara se o valor realmente mudou)
drop trigger if exists produtos_limpar_fotos_trocar on public.produtos;
create trigger produtos_limpar_fotos_trocar
  after update of fotos, foto_banner on public.produtos
  for each row
  when (old.fotos is distinct from new.fotos or old.foto_banner is distinct from new.foto_banner)
  execute function public.produtos_limpar_fotos();

-- Para desfazer:
--   drop trigger if exists produtos_limpar_fotos_apagar on public.produtos;
--   drop trigger if exists produtos_limpar_fotos_trocar on public.produtos;
--   drop function if exists public.produtos_limpar_fotos();
