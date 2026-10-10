/* Montagem da lista de produtos do painel (funções puras: recebem dados, devolvem HTML). */
import { SUPABASE_URL, BUCKET } from './config.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const brl = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 2 : 0 });

/* a miniatura de cada foto enviada pelo painel fica ao lado dela, com "-thumb" no nome */
export const caminhoThumb = (caminho) => caminho.replace(/(\.\w+)$/, '-thumb$1');
export const ehExemplo = (p) => /\(exemplo\)\s*$/i.test(p.nome);
export const caminhoDeExemplo = (caminho) => caminho.startsWith('exemplo/');

const urlBucket = (caminho) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${caminho}`;
const urlLocal = (caminho) => '../img/' + caminho.split('/').pop();

/* endereços a tentar, em ordem: miniatura, foto inteira, cópia local de img/ */
export const fontesDoCaminho = (caminho, comMiniatura = true) => {
  const fontes = comMiniatura && !caminhoDeExemplo(caminho) ? [urlBucket(caminhoThumb(caminho))] : [];
  fontes.push(urlBucket(caminho), urlLocal(caminho));
  return fontes;
};

/* <img> que, se a primeira fonte falhar, tenta as outras (tratado em admin.js);
   a foto do banner não tem miniatura, então comMiniatura = false */
export const imgDoCaminho = (caminho, alt = '', comMiniatura = true) => {
  const [primeira, ...reserva] = fontesDoCaminho(caminho, comMiniatura);
  return `<img src="${esc(primeira)}" data-reserva="${esc(reserva.join('|'))}" alt="${esc(alt)}" loading="lazy">`;
};

export const ofertaValida = (p) =>
  Boolean(p.oferta && p.preco != null && p.preco_original > p.preco && (!p.oferta_ate || new Date(p.oferta_ate) > new Date()));

export const desconto = (p) => Math.round((1 - p.preco / p.preco_original) * 100);

const preco = (p) => {
  if (p.preco == null) return '<strong class="preco sem-preco">Sem preço</strong>';
  const original = ofertaValida(p) ? `<s>${brl(Number(p.preco_original))}</s>` : '';
  return `<strong class="preco">${brl(Number(p.preco))}</strong>${original}`;
};

export const linhaProduto = (p) => {
  const foto = p.fotos?.[0] ? imgDoCaminho(p.fotos[0]) : '<span class="sem-foto">Sem foto</span>';
  const vendido = Number(p.estoque) === 0;
  const tags = [
    `<span class="tag">${p.categoria === 'joia' ? 'Joia' : 'Pedra'}</span>`,
    ofertaValida(p) ? `<span class="tag tag-oferta">Oferta -${desconto(p)}%</span>` : '',
    p.no_banner ? '<span class="tag tag-banner">Banner</span>' : '',
    vendido ? '<span class="tag tag-vendido">Vendido</span>' : '',
    ehExemplo(p) ? '<span class="tag tag-exemplo">Exemplo</span>' : '',
    p.ativo ? '' : '<span class="tag tag-escondido">Escondido</span>'
  ].join('');

  return `<li class="item${p.ativo ? '' : ' escondido'}" data-id="${esc(p.id)}">
    <div class="thumb">${foto}</div>
    <div class="meta">
      <h3>${esc(p.nome)}</h3>
      <p>${esc(p.detalhes)}</p>
      <div class="tags">${tags}</div>
    </div>
    <div class="side">${preco(p)}<span class="estoque">Estoque: ${Number(p.estoque) || 0}</span></div>
    <div class="acoes">
      <button type="button" class="btn-editar" aria-label="Editar ${esc(p.nome)}">Editar</button>
      <button type="button" class="switch" role="switch" aria-checked="${p.ativo}" aria-label="Visível na loja: ${esc(p.nome)}"><i></i></button>
    </div>
  </li>`;
};
