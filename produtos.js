/* Catálogo: lê os produtos do Supabase e monta as fileiras, o carrossel de ofertas e o banner.
   Só a chave pública (anon) vai no navegador: o RLS deixa ela ler apenas produtos ativos. */
(() => {
  const SUPABASE_URL = 'https://vcunrbzfinnnyjviwlag.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdW5yYnpmaW5ubnlqdml3bGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjAxOTYsImV4cCI6MjEwNzIzNjE5Nn0.t0NRuguarsR5nv6LjtndZj-0JnY0gB-w5ogyBXUsDDo';
  const MAX_OFERTAS = 5;   // o banner do topo foi desenhado para 5 tomadas

  const CORES = {
    esmeralda: { c: '#12b886', d: '#03130e' },
    safira: { c: '#2f5df0', d: '#060d2e' },
    rubi: { c: '#e11d48', d: '#2a050f' },
    ametista: { c: '#9d4edd', d: '#1a0830' },
    topazio: { c: '#f59e0b', d: '#2b1703' },
    diamante: { c: '#38a8e0', d: '#06202e' }
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const brl = (n) => 'R$ ' + (n == null ? '0.000' : n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 2 : 0 }));
  const desconto = (p) => Math.round((1 - p.preco / p.preco_original) * 100);
  const precoHtml = (p) => (p.emOferta ? `${brl(p.preco)} <s>${brl(p.preco_original)}</s>` : brl(p.preco));
  const cor = (p) => CORES[p.cor] || CORES.esmeralda;

  /* a foto vem do bucket "produtos"; se ainda não estiver lá, cai na cópia local de img/ */
  const foto = (p) => (p.fotos?.[0] ? `${SUPABASE_URL}/storage/v1/object/public/produtos/${p.fotos[0]}` : '');
  const fotoLocal = (p) => 'img/' + (p.fotos?.[0] || '').split('/').pop();
  const img = (p, attrs = '') => `<img ${attrs} src="${esc(foto(p))}" data-fallback="${esc(fotoLocal(p))}" alt="${esc(p.nome)}">`;
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (el.tagName === 'IMG' && el.dataset.fallback && !el.dataset.tried) { el.dataset.tried = '1'; el.src = el.dataset.fallback; }
  }, true);

  const card = (p) => `<article class="card${p.vendido ? ' vendido' : ''}" data-id="${esc(p.id)}"><div class="ph">${img(p)}${p.vendido ? '<span class="sold">Vendido</span>' : p.emOferta ? `<span class="off">-${desconto(p)}%</span>` : ''}</div><h3>${esc(p.nome)}</h3><p>${esc(p.detalhes)}</p><div class="card-foot"><span>${brl(p.preco)}${p.emOferta ? `<s>${brl(p.preco_original)}</s>` : ''}</span><button>Ver</button></div></article>`;

  const slide = (p) => `<article class="slide" data-id="${esc(p.id)}" data-tint="${cor(p).c}"><div class="tile"><span class="off">-${desconto(p)}%</span>${img(p)}</div><div class="info"><p class="kicker">${esc(p.detalhes)}</p><h3>${esc(p.nome)}</h3><div class="prices"><strong>${brl(p.preco)}</strong><s>${brl(p.preco_original)}</s></div><a href="#" class="buy">Aproveitar oferta</a></div></article>`;

  const bannerSlide = (p, i) => {
    const [primeira, ...resto] = p.nome.split(' ');
    return `<div class="ob-slide" style="--c:${cor(p).c};--d:${cor(p).d};--dl:${i * 5}s"><div class="ob-text" aria-hidden="true"><span class="ln k">Oferta imperdível · -${desconto(p)}%</span><span class="ln ob-name">${esc(primeira)}<br>${esc(resto.join(' '))}</span><span class="ln ob-price"><strong>${brl(p.preco)}</strong><s>${brl(p.preco_original)}</s></span></div>${img(p, 'class="ob-gem"').replace('alt="' + esc(p.nome) + '"', 'alt=""')}</div>`;
  };

  const render = (lista) => {
    // as primeiras ofertas vão para o banner e o carrossel; as que passam do limite ficam só na fileira, com a etiqueta
    const ofertas = lista.filter((p) => p.emOferta).slice(0, MAX_OFERTAS);
    const normais = lista.filter((p) => !ofertas.includes(p));
    const preencher = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

    preencher('rowPedras', normais.filter((p) => p.categoria === 'pedra').map(card).join(''));
    preencher('rowJoias', normais.filter((p) => p.categoria === 'joia').map(card).join(''));
    preencher('offerSlides', ofertas.map(slide).join(''));
    preencher('offerSegs', ofertas.map((_, i) => `<button class="seg" aria-label="Oferta ${i + 1}"><i></i></button>`).join(''));
    preencher('dealsBanner', ofertas.map(bannerSlide).join(''));
    const secao = document.getElementById('ofertas');
    if (secao) secao.hidden = ofertas.length === 0;
  };

  const carregar = async () => {
    const campos = 'id,nome,categoria,titulo,descricao,detalhes,cor,preco,preco_original,oferta,oferta_ate,fotos,estoque,ordem';
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=${campos}&ativo=eq.true&order=ordem.asc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (!res.ok) throw new Error(`Supabase respondeu ${res.status}`);
      const agora = Date.now();
      const lista = (await res.json()).map((p) => {
        const preco = p.preco == null ? null : Number(p.preco);
        const original = p.preco_original == null ? null : Number(p.preco_original);
        const vendido = Number(p.estoque) === 0;
        // produto vendido não é promovido: sai do banner e do carrossel e fica na fileira, com a etiqueta
        const valida = p.oferta && preco != null && original > preco && (!p.oferta_ate || new Date(p.oferta_ate) > agora) && !vendido;
        return { ...p, preco, preco_original: original, vendido, emOferta: Boolean(valida) };
      });
      window.Loja.produtos = lista;
      render(lista);
    } catch (err) {
      console.warn('Não foi possível carregar os produtos:', err);
      const aviso = document.getElementById('searchEmpty');
      if (aviso) { aviso.textContent = 'Não foi possível carregar os produtos agora. Tente novamente em instantes.'; aviso.hidden = false; }
    }
  };

  window.Loja = { produtos: [], esc, precoHtml };
  window.Loja.pronto = carregar();
})();
