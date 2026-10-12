/* Leitura e validação dos campos do produto (funções puras, mensagens em português). */

const PRECO_MAXIMO = 9999999999.99;
const ESTOQUE_MAXIMO = 1000000;

/* aceita "15.900,50", "15900,5", "15900.5" e "15.900"; devolve null (vazio), NaN (inválido) ou o número */
export const lerPreco = (texto) => {
  let s = String(texto ?? '').replace(/R\$|\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
};

export const textoPreco = (n) =>
  n == null ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const calcularDesconto = (oferta, original) =>
  oferta > 0 && original > oferta ? Math.round((1 - oferta / original) * 100) : null;

const checarPreco = (texto, { rotulo, vazio }) => {
  const n = lerPreco(texto);
  if (n === null) return { erro: vazio };
  if (Number.isNaN(n)) return { erro: 'Valor inválido. Use só números, por exemplo 1.500,00.' };
  if (n <= 0) return { erro: `${rotulo} deve ser maior que zero.` };
  if (n > PRECO_MAXIMO) return { erro: 'Esse valor é alto demais.' };
  return { valor: n };
};

/* data "AAAA-MM-DD" vira o fim daquele dia, no horário local */
export const fimDoDia = (iso) => {
  const [a, m, d] = String(iso).split('-').map(Number);
  const data = new Date(a, m - 1, d, 23, 59, 59);
  return Number.isNaN(data.getTime()) || !a ? null : data;
};

export const dataLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const dois = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

/**
 * @param {{nome:string, oferta:boolean, preco:string, precoOferta:string, precoOriginal:string, estoque:string, termino:string}} d
 * @returns {{erros: Record<string,string>, valores: object|null}}
 */
export const validarProduto = (d, agora = new Date()) => {
  const erros = {};
  const v = {};

  const nome = String(d.nome ?? '').trim();
  if (!nome) erros.nome = 'Informe o nome do produto.';
  else if (nome.length > 120) erros.nome = 'O nome pode ter no máximo 120 caracteres.';
  else v.nome = nome;

  if (d.oferta) {
    const oferta = checarPreco(d.precoOferta, { rotulo: 'O preço da oferta', vazio: 'Informe o preço da oferta.' });
    const original = checarPreco(d.precoOriginal, { rotulo: 'O preço original', vazio: 'Informe o preço original.' });
    if (oferta.erro) erros.precoOferta = oferta.erro;
    if (original.erro) erros.precoOriginal = original.erro;
    if (!oferta.erro && !original.erro) {
      if (original.valor <= oferta.valor) erros.precoOriginal = 'O preço original deve ser maior que o preço da oferta.';
      else { v.preco = oferta.valor; v.preco_original = original.valor; }
    }
    if (d.termino) {
      const fim = fimDoDia(d.termino);
      if (!fim) erros.termino = 'Data de término inválida.';
      else if (fim <= agora) erros.termino = 'A data de término não pode ser no passado.';
      else v.oferta_ate = fim.toISOString();
    }
    v.oferta = true;
    v.oferta_ate ??= null;
  } else {
    const normal = checarPreco(d.preco, { rotulo: 'O preço', vazio: 'Informe o preço.' });
    if (normal.erro) erros.preco = normal.erro;
    else v.preco = normal.valor;
    Object.assign(v, { oferta: false, preco_original: null, oferta_ate: null });
  }

  const estoque = String(d.estoque ?? '').trim();
  if (!estoque) erros.estoque = 'Informe o estoque (use 0 se não houver).';
  else if (!/^\d+$/.test(estoque)) erros.estoque = 'O estoque deve ser um número inteiro, zero ou mais.';
  else if (Number(estoque) > ESTOQUE_MAXIMO) erros.estoque = 'Esse estoque é alto demais.';
  else v.estoque = Number(estoque);

  return { erros, valores: Object.keys(erros).length ? null : v };
};

/* ---------- senha do painel ---------- */
/* mesmas regras do Supabase Auth ("Lowercase, uppercase letters, digits and symbols"); o Auth só
   conta como símbolo os caracteres abaixo, e não aceita senha com mais de 72 caracteres */
export const SENHA_MINIMO = 12;
const SENHA_MAXIMO = 72;
export const REGRAS_SENHA = [
  ['tamanho', `Pelo menos ${SENHA_MINIMO} caracteres`, (s) => s.length >= SENHA_MINIMO],
  ['minuscula', 'Uma letra minúscula', (s) => /[a-z]/.test(s)],
  ['maiuscula', 'Uma letra maiúscula', (s) => /[A-Z]/.test(s)],
  ['numero', 'Um número', (s) => /[0-9]/.test(s)],
  ['simbolo', 'Um símbolo, como ! @ # $ % *', (s) => /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/.test(s)]
];

/**
 * @param {{atual:string, nova:string, repetida:string, recuperacao:boolean}} d
 * @returns {Record<string,string>} erros por campo (vazio = tudo certo)
 */
export const validarSenha = ({ atual = '', nova = '', repetida = '', recuperacao = false }) => {
  const erros = {};
  if (!recuperacao && !atual) erros.atual = 'Digite a senha atual.';
  if (!nova) erros.nova = 'Digite a nova senha.';
  else if (nova.length > SENHA_MAXIMO) erros.nova = `A senha pode ter no máximo ${SENHA_MAXIMO} caracteres.`;
  else if (!REGRAS_SENHA.every(([, , ok]) => ok(nova))) erros.nova = 'A senha ainda não cumpre todas as regras abaixo.';
  else if (!recuperacao && nova === atual) erros.nova = 'A nova senha precisa ser diferente da atual.';
  if (nova && repetida !== nova) erros.repetida = 'As senhas não são iguais.';
  return erros;
};
