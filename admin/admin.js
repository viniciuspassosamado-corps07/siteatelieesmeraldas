/* Painel /admin: login (Supabase Auth), lista de produtos e visível/escondido.
   Novo, editar, apagar e fotos ficam em form.js. Quem entra precisa estar na tabela admins;
   as escritas também são barradas pelo RLS no banco. */
import { createClient } from '/vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET } from './config.js';
import { linhaProduto, ofertaValida } from './lista.js';
import { criarFormulario } from './form.js';
import { criarTrocaSenha } from './senha.js';

/* o link de "Esqueci a senha" volta para cá com #...type=recovery (ou #error=... se expirou);
   lido antes do createClient, que limpa o endereço ao entrar */
const hashInicial = new URLSearchParams(location.hash.slice(1));
let recuperando = hashInicial.get('type') === 'recovery';
const linkInvalido = hashInicial.has('error') || hashInicial.has('error_code');

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (seletor) => document.querySelector(seletor);

const el = {
  barra: $('#barra'), usuario: $('#usuarioEmail'), trocarSenha: $('#trocarSenha'), sair: $('#sair'),
  login: $('#login'), form: $('#loginForm'), email: $('#email'), senha: $('#senha'), erro: $('#loginErro'), info: $('#loginInfo'),
  entrar: $('#loginBtn'), esqueci: $('#esqueci'),
  painel: $('#painel'), contagem: $('#contagem'), novo: $('#novoProduto'), busca: $('#busca'), segmentos: $('#segmentos'),
  lista: $('#lista'), vazio: $('#vazio'), toast: $('#toast')
};

let produtos = [];
let emailLogado = null;
let filtro = 'todos';
let termo = '';

const normaliza = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ---------- avisos ---------- */
let timerToast;
const aviso = (texto) => {
  el.toast.textContent = texto;
  el.toast.classList.add('on');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => el.toast.classList.remove('on'), 4200);
};

/* ---------- telas ---------- */
const mostrarLogin = (mensagem = '') => {
  produtos = [];
  emailLogado = null;
  el.info.hidden = true;
  el.barra.hidden = true;
  el.painel.hidden = true;
  el.login.hidden = false;
  el.erro.hidden = !mensagem;
  el.erro.textContent = mensagem;
  el.entrar.disabled = false;
  el.entrar.textContent = 'Entrar';
  el.senha.value = '';
};

const mostrarPainel = (email) => {
  emailLogado = email;
  el.login.hidden = true;
  el.barra.hidden = false;
  el.painel.hidden = false;
  el.usuario.textContent = email;
};

/* ---------- lista ---------- */
const passaNoFiltro = (p) => {
  if (filtro === 'pedra' || filtro === 'joia') return p.categoria === filtro;
  if (filtro === 'oferta') return ofertaValida(p);
  if (filtro === 'escondido') return !p.ativo;
  return true;
};

const ordenar = () => produtos.sort((a, b) => (a.categoria === b.categoria ? a.ordem - b.ordem : a.categoria < b.categoria ? 1 : -1));

const desenhar = () => {
  const q = normaliza(termo.trim());
  const visiveis = produtos.filter((p) => passaNoFiltro(p) && (!q || normaliza(`${p.nome} ${p.detalhes}`).includes(q)));
  el.lista.innerHTML = visiveis.map(linhaProduto).join('');
  const total = produtos.length;
  el.contagem.textContent = total ? `${total} ${total === 1 ? 'produto' : 'produtos'}` : '';
  el.vazio.hidden = visiveis.length > 0;
  el.vazio.textContent = total ? 'Nenhum produto neste filtro.' : 'Nenhum produto cadastrado ainda.';
};

const CAMPOS = 'id,nome,categoria,titulo,descricao,detalhes,cor,preco,preco_original,oferta,oferta_ate,fotos,estoque,ativo,ordem,no_banner,foto_banner';

const carregar = async () => {
  const { data, error } = await sb.from('produtos').select(CAMPOS).order('categoria', { ascending: false }).order('ordem', { ascending: true }).order('criado_em', { ascending: true });
  if (error) {
    aviso('Não foi possível carregar os produtos. Atualize a página para tentar de novo.');
    console.warn('Falha ao carregar os produtos:', error.code ?? error.name);
    return;
  }
  produtos = data;
  desenhar();
};

const formulario = criarFormulario({
  sb,
  bucket: BUCKET,
  obterProdutos: () => produtos,
  aviso,
  aoSalvar: (registro, novo) => {
    produtos = novo ? [...produtos, registro] : produtos.map((p) => (p.id === registro.id ? registro : p));
    ordenar();
    desenhar();
    aviso(novo ? 'Produto criado.' : 'Produto salvo.');
  },
  aoApagar: (id) => {
    produtos = produtos.filter((p) => p.id !== id);
    desenhar();
    aviso('Produto apagado.');
  }
});

const trocaSenha = criarTrocaSenha({ sb, aviso });
/* quem chegou pelo link de recuperação cai direto na folha de criar a senha nova */
const abrirRecuperacao = () => {
  if (!recuperando || !emailLogado) return;
  recuperando = false;
  trocaSenha.abrir({ email: emailLogado, recuperacao: true });
};

/* ---------- login ---------- */
const entrar = async (user) => {
  const { data, error } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !data) {
    await sb.auth.signOut();
    mostrarLogin('Esta conta não tem acesso ao painel.');
    return;
  }
  mostrarPainel(user.email);
  abrirRecuperacao();
  await carregar();
};

el.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = el.email.value.trim();
  const senha = el.senha.value;
  if (!email || !senha) {
    el.erro.hidden = false;
    el.erro.textContent = 'Preencha o e-mail e a senha.';
    return;
  }
  el.erro.hidden = true;
  el.entrar.disabled = true;
  el.entrar.textContent = 'Entrando…';
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) {
    mostrarLogin('E-mail ou senha incorretos.');
    return;
  }
  await entrar(data.user);
});

el.sair.addEventListener('click', async () => {
  await sb.auth.signOut();
  mostrarLogin();
});

el.trocarSenha.addEventListener('click', () => { if (emailLogado) trocaSenha.abrir({ email: emailLogado }); });

/* "Esqueci a senha": a resposta é sempre a mesma, para não revelar quais e-mails existem */
el.esqueci.addEventListener('click', async () => {
  const email = el.email.value.trim();
  el.info.hidden = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    el.erro.hidden = false;
    el.erro.textContent = 'Digite seu e-mail no campo acima e toque de novo em "Esqueci a senha".';
    el.email.focus();
    return;
  }
  el.erro.hidden = true;
  el.esqueci.disabled = true;
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin/` });
    if (error?.status === 429) {
      el.erro.hidden = false;
      el.erro.textContent = 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.';
      return;
    }
    el.info.hidden = false;
    el.info.textContent = 'Se esse e-mail for de um administrador, um link para criar uma senha nova chega em instantes. Confira também o spam.';
  } catch {
    el.erro.hidden = false;
    el.erro.textContent = 'Sem conexão. Confira a internet e tente de novo.';
  } finally {
    el.esqueci.disabled = false;
  }
});

/* ---------- visível / escondido ---------- */
const alternarAtivo = async (id) => {
  const p = produtos.find((x) => x.id === id);
  if (!p) return;
  p.ativo = !p.ativo;
  desenhar();
  const { error } = await sb.from('produtos').update({ ativo: p.ativo }).eq('id', id);
  if (error) {
    p.ativo = !p.ativo;
    desenhar();
    aviso('Não foi possível alterar. Tente de novo.');
    return;
  }
  aviso(p.ativo ? 'Produto visível na loja.' : 'Produto escondido da loja.');
};

/* ---------- eventos da lista e dos filtros ---------- */
el.novo.addEventListener('click', () => formulario.abrir());
el.lista.addEventListener('click', (e) => {
  const id = e.target.closest('.item')?.dataset.id;
  if (!id) return;
  if (e.target.closest('.switch')) return alternarAtivo(id);
  formulario.abrir(produtos.find((p) => p.id === id));   // tocar no card (ou em Editar) abre o formulário
});

el.busca.addEventListener('input', () => { termo = el.busca.value; desenhar(); });
el.segmentos.addEventListener('click', (e) => {
  const botao = e.target.closest('button[data-filtro]');
  if (!botao) return;
  filtro = botao.dataset.filtro;
  el.segmentos.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b === botao));
  desenhar();
});

/* fotos que não existem no bucket caem na próxima opção da lista (foto inteira, cópia local) */
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.dataset.reserva) return;
  const [proxima, ...resto] = img.dataset.reserva.split('|');
  img.dataset.reserva = resto.join('|');
  if (proxima) img.src = proxima;
}, true);

/* ---------- início ---------- */
sb.auth.onAuthStateChange((evento) => {
  if (evento === 'SIGNED_OUT') mostrarLogin();
  if (evento === 'PASSWORD_RECOVERY') { recuperando = true; abrirRecuperacao(); }
});

const { data: { session } } = await sb.auth.getSession();
if (linkInvalido) history.replaceState(null, '', location.pathname + location.search);
if (session) await entrar(session.user);
else mostrarLogin(linkInvalido ? 'O link para criar a senha nova expirou ou já foi usado. Toque em "Esqueci a senha" para receber outro.' : '');
