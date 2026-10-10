/* Catálogo: lê os produtos do Supabase e monta as fileiras, o carrossel de ofertas e o banner.
   Só a chave pública (anon) vai no navegador: o RLS deixa ela ler apenas produtos ativos. */
(() => {
  const SUPABASE_URL = 'https://vcunrbzfinnnyjviwlag.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdW5yYnpmaW5ubnlqdml3bGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjAxOTYsImV4cCI6MjEwNzIzNjE5Nn0.t0NRuguarsR5nv6LjtndZj-0JnY0gB-w5ogyBXUsDDo';
  const MAX_BANNER = 5;       // o banner do topo foi desenhado para 5 tomadas (mesmo limite de MAX_BANNER em admin/config.js)
  const MAX_CARROSSEL = 8;    // teto do carrossel "Ofertas imperdíveis" (mesmo limite em admin/config.js)

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
  const urlFoto = (caminho) => (caminho ? `${SUPABASE_URL}/storage/v1/object/public/produtos/${caminho}` : '');
  const fotoLocal = (caminho) => 'img/' + (caminho || '').split('/').pop();
  const img = (p, attrs = '', caminho = p.fotos?.[0]) => `<img ${attrs} src="${esc(urlFoto(caminho))}" data-fallback="${esc(fotoLocal(caminho))}" alt="${esc(p.nome)}">`;
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (el.tagName === 'IMG' && el.dataset.fallback && !el.dataset.tried) { el.dataset.tried = '1'; el.src = el.dataset.fallback; }
  }, true);

  const card = (p) => `<article class="card${p.vendido ? ' vendido' : ''}" data-id="${esc(p.id)}"><div class="ph">${img(p)}${p.vendido ? '<span class="sold">Vendido</span>' : p.emOferta ? `<span class="off">-${desconto(p)}%</span>` : ''}</div><h3>${esc(p.nome)}</h3><p>${esc(p.detalhes)}</p><div class="card-foot"><span>${brl(p.preco)}${p.emOferta ? `<s>${brl(p.preco_original)}</s>` : ''}</span><button>Ver</button></div></article>`;

  const slide = (p) => `<article class="slide" data-id="${esc(p.id)}" data-tint="${cor(p).c}"><div class="tile"><span class="off">-${desconto(p)}%</span>${img(p)}</div><div class="info"><p class="kicker">${esc(p.detalhes)}</p><h3>${esc(p.nome)}</h3><div class="prices"><strong>${brl(p.preco)}</strong><s>${brl(p.preco_original)}</s></div><a href="#" class="buy">Aproveitar oferta</a></div></article>`;

  /* uma tomada do banner: kicker, nome, preço e (se for oferta válida) o preço original riscado;
     a foto é a do banner, se o dono enviou uma, senão a primeira foto do produto */
  const bannerSlide = (p, i) => {
    const [primeira, ...resto] = p.nome.split(' ');
    const kicker = p.emOferta ? `Oferta imperdível · -${desconto(p)}%` : 'Destaque';
    const preco = p.preco == null ? '' : `<strong>${brl(p.preco)}</strong>${p.emOferta ? `<s>${brl(p.preco_original)}</s>` : ''}`;
    const foto = img(p, 'class="ob-gem"', p.foto_banner || p.fotos?.[0]).replace('alt="' + esc(p.nome) + '"', 'alt=""');
    return `<div class="ob-slide" style="--c:${cor(p).c};--d:${cor(p).d};--dl:${i * 5}s"><div class="ob-text" aria-hidden="true"><span class="ln k">${kicker}</span><span class="ln ob-name">${esc(primeira)}<br>${esc(resto.join(' '))}</span><span class="ln ob-price">${preco}</span></div>${foto}</div>`;
  };

  /* decide o que vai em cada lugar (função pura, sem tocar na página) */
  const selecionar = (lista) => {
    // carrossel: só ofertas válidas, no máximo MAX_CARROSSEL; as que passam do teto ficam só na fileira, com a etiqueta
    const carrossel = lista.filter((p) => p.emOferta).slice(0, MAX_CARROSSEL);
    // banner: produtos marcados (ativos e com estoque, na ordem de exibição); sem nenhum, usa as ofertas
    const marcados = lista.filter((p) => p.no_banner && !p.vendido);
    const banner = (marcados.length ? marcados : lista.filter((p) => p.emOferta)).slice(0, MAX_BANNER);
    const fileiras = lista.filter((p) => !carrossel.includes(p));
    return { carrossel, banner, fileiras };
  };

  const render = (lista) => {
    const { carrossel, banner, fileiras } = selecionar(lista);
    const preencher = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

    preencher('rowPedras', fileiras.filter((p) => p.categoria === 'pedra').map(card).join(''));
    preencher('rowJoias', fileiras.filter((p) => p.categoria === 'joia').map(card).join(''));
    preencher('offerSlides', carrossel.map(slide).join(''));
    preencher('offerSegs', carrossel.map((_, i) => `<button class="seg" aria-label="Oferta ${i + 1}"><i></i></button>`).join(''));
    preencher('dealsBanner', banner.map(bannerSlide).join(''));
    const secao = document.getElementById('ofertas');
    if (secao) secao.hidden = carrossel.length === 0;
  };

  const carregar = async () => {
    const campos = 'id,nome,categoria,titulo,descricao,detalhes,cor,preco,preco_original,oferta,oferta_ate,fotos,estoque,ordem,no_banner,foto_banner';
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=${campos}&ativo=eq.true&order=ordem.asc,criado_em.asc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (!res.ok) throw new Error(`Supabase respondeu ${res.status}`);
      const agora = Date.now();
      const lista = (await res.json()).map((p) => {
        const preco = p.preco == null ? null : Number(p.preco);
        const original = p.preco_original == null ? null : Number(p.preco_original);
        const vendido = Number(p.estoque) === 0;
        // produto vendido não é promovido: sai do carrossel (e do banner, ver selecionar) e fica na fileira, com a etiqueta
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

  const fotoUrl = (caminho) => `${SUPABASE_URL}/storage/v1/object/public/produtos/${caminho}`;
  const fotoReserva = (caminho) => 'img/' + String(caminho).split('/').pop();
  window.Loja = { produtos: [], esc, precoHtml, fotoUrl, fotoReserva, selecionar };
  window.Loja.pronto = carregar();
})();
