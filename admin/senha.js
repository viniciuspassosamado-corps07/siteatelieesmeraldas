/* Folha "Trocar senha" do painel. Com a sessão normal, pede a senha atual e confere antes de trocar
   (quem achar o painel aberto num aparelho não consegue trocar a senha sozinho). Quando o dono chega
   pelo link de "Esqueci a senha", só pede a nova. Ao salvar, os outros aparelhos saem da conta. */
import { esc } from './lista.js';
import { REGRAS_SENHA, validarSenha } from './validacao.js';

const mensagemErro = (error) => {
  if (error.code === 'same_password') return 'A nova senha precisa ser diferente da atual.';
  if (error.code === 'weak_password') return 'Essa senha foi recusada por ser fraca ou já ter aparecido em vazamentos. Escolha outra.';
  if (error.code === 'reauthentication_needed' || error.status === 401) return 'Sua sessão expirou. Saia, entre de novo e tente outra vez.';
  if (error.status === 429) return 'Muitas tentativas seguidas. Espere alguns minutos.';
  return 'Não foi possível trocar a senha. Tente de novo.';
};

export function criarTrocaSenha({ sb, aviso }) {
  let aberta = false;

  const campo = (id, rotulo, auto) =>
    `<div class="campo"><label for="s-${id}">${rotulo}</label><input id="s-${id}" name="${id}" type="password" autocomplete="${auto}" maxlength="72" autocapitalize="none" spellcheck="false"><p class="erro-campo" data-erro="${id}" hidden></p></div>`;

  function abrir({ email, recuperacao = false }) {
    if (aberta) return;
    aberta = true;
    let ocupado = false;

    const raiz = document.createElement('div');
    raiz.className = 'folha-raiz';
    raiz.innerHTML = `<div class="fundo"></div>
<form class="folha folha-senha" role="dialog" aria-modal="true" aria-labelledby="senhaTitulo" tabindex="-1" novalidate>
  <header class="folha-topo">
    <button type="button" class="link" data-acao="fechar">${recuperacao ? 'Depois' : 'Cancelar'}</button>
    <h2 id="senhaTitulo">${recuperacao ? 'Criar nova senha' : 'Trocar senha'}</h2>
    <button type="submit" class="link forte" data-salvar>Salvar</button>
  </header>
  <div class="folha-corpo">
    <p class="erro-geral" data-erro-geral role="alert" hidden></p>
    <section class="grupo">
      <input type="email" name="usuario" autocomplete="username" value="${esc(email)}" hidden>
      ${recuperacao ? '' : campo('atual', 'Senha atual', 'current-password')}
      ${campo('nova', 'Nova senha', 'new-password')}
      <ul class="regras" aria-label="A nova senha precisa ter">
        ${REGRAS_SENHA.map(([id, texto]) => `<li data-regra="${id}">${texto}</li>`).join('')}
      </ul>
      ${campo('repetida', 'Repita a nova senha', 'new-password')}
      <label class="mostrar"><input type="checkbox" data-mostrar> Mostrar senhas</label>
    </section>
    <p class="dica">Ao salvar, os outros aparelhos conectados ao painel saem da conta.</p>
  </div>
</form>`;
    document.body.append(raiz);
    document.documentElement.style.overflow = 'hidden';
    const $ = (s) => raiz.querySelector(s);
    const form = $('.folha');
    const valor = (id) => $(`#s-${id}`)?.value ?? '';

    const marcarRegras = () => {
      const s = valor('nova');
      REGRAS_SENHA.forEach(([id, , ok]) => $(`[data-regra="${id}"]`).classList.toggle('ok', ok(s)));
    };
    const mostrarErros = (erros) => {
      raiz.querySelectorAll('[data-erro]').forEach((p) => {
        const msg = erros[p.dataset.erro];
        p.hidden = !msg;
        p.textContent = msg ?? '';
        $(`#s-${p.dataset.erro}`).setAttribute('aria-invalid', String(Boolean(msg)));
      });
      const primeiro = Object.keys(erros)[0];
      if (primeiro) $(`#s-${primeiro}`).focus();
    };
    const erroGeral = (msg = '') => {
      const p = $('[data-erro-geral]');
      p.hidden = !msg;
      p.textContent = msg;
    };
    const ocupar = (sim) => {
      ocupado = sim;
      form.classList.toggle('ocupado', sim);
      $('[data-salvar]').disabled = sim;
      $('[data-salvar]').textContent = sim ? 'Salvando…' : 'Salvar';
    };

    /* ----- fechar ----- */
    const encerrar = () => {
      document.removeEventListener('keydown', aoTeclar);
      document.documentElement.style.overflow = '';
      aberta = false;
      $('.fundo').classList.remove('on');
      form.classList.remove('on');
      setTimeout(() => raiz.remove(), 450);
    };
    const fechar = () => { if (!ocupado) encerrar(); };
    const aoTeclar = (ev) => { if (ev.key === 'Escape') fechar(); };
    document.addEventListener('keydown', aoTeclar);
    $('[data-acao="fechar"]').addEventListener('click', fechar);

    /* ----- campos ----- */
    form.addEventListener('input', (ev) => {
      if (ev.target.id === 's-nova') marcarRegras();
      const erro = ev.target.id && $(`[data-erro="${ev.target.id.slice(2)}"]`);
      if (erro && !erro.hidden) { erro.hidden = true; ev.target.setAttribute('aria-invalid', 'false'); }
    });
    $('[data-mostrar]').addEventListener('change', (ev) => {
      raiz.querySelectorAll('input[type="password"], input[data-senha]').forEach((i) => {
        i.dataset.senha = '';
        i.type = ev.target.checked ? 'text' : 'password';
      });
    });

    /* ----- salvar ----- */
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (ocupado) return;
      erroGeral();
      const dados = { atual: valor('atual'), nova: valor('nova'), repetida: valor('repetida'), recuperacao };
      const erros = validarSenha(dados);
      mostrarErros(erros);
      if (Object.keys(erros).length) return;

      ocupar(true);
      try {
        if (!recuperacao) {
          const { error } = await sb.auth.signInWithPassword({ email, password: dados.atual });
          if (error) {
            mostrarErros({ atual: error.status === 429 ? 'Muitas tentativas seguidas. Espere alguns minutos.' : 'Senha atual incorreta.' });
            return;
          }
        }
        const { error } = await sb.auth.updateUser({ password: dados.nova });
        if (error) {
          erroGeral(mensagemErro(error));
          return;
        }
        await sb.auth.signOut({ scope: 'others' });
        encerrar();
        aviso('Senha alterada. Os outros aparelhos saíram da conta.');
      } catch {
        erroGeral('Sem conexão. Confira a internet e tente de novo.');
      } finally {
        if (aberta) ocupar(false);
      }
    });

    requestAnimationFrame(() => {
      $('.fundo').classList.add('on');
      form.classList.add('on');
      form.focus({ preventScroll: true });
    });
  }

  return { abrir };
}
