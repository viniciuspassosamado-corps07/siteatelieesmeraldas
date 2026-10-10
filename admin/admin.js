/* Painel /admin: login (Supabase Auth), lista de produtos e visível/escondido.
   Novo, editar, apagar e fotos ficam em form.js. Quem entra precisa estar na tabela admins;
   as escritas também são barradas pelo RLS no banco. */
import { createClient } from '/vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET } from './config.js';
import { linhaProduto, ofertaValida } from './lista.js';
import { criarFormulario } from './form.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (seletor) => document.querySelector(seletor);

const el = {
  barra: $('#barra'), usuario: $('#usuarioEmail'), sair: $('#sair'),
  login: $('#login'), form: $('#loginForm'), email: $('#email'), senha: $('#senha'), erro: $('#loginErro'), entrar: $('#loginBtn'),
  painel: $('#painel'), contagem: $('#contagem'), novo: $('#novoProduto'), busca: $('#busca'), segmentos: $('#segmentos'),
  lista: $('#lista'), vazio: $('#vazio'), toast: $('#toast')
};

let produtos = [];
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

const CAMPOS = 'id,nome,categoria,titulo,descricao,detalhes,cor,preco,preco_original,oferta,oferta_ate,fotos,estoque,ativo,ordem';

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

/* ---------- login ---------- */
const entrar = async (user) => {
  const { data, error } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !data) {
    await sb.auth.signOut();
    mostrarLogin('Esta conta não tem acesso ao painel.');
    return;
  }
  mostrarPainel(user.email);
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
sb.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT') mostrarLogin(); });

const { data: { session } } = await sb.auth.getSession();
if (session) await entrar(session.user);
else mostrarLogin();
