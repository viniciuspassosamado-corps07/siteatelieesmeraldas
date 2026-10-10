const island = document.getElementById('island');
const toggleBtn = document.getElementById('toggleBtn');

const setOpen = (open) => {
  island.classList.toggle('open', open);
  toggleBtn.setAttribute('aria-expanded', open);
  toggleBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
};

/* ofertas: carrossel automático (espera os produtos chegarem do banco) */
Loja.pronto.then(() => {
  const card = document.getElementById('offers');
  if (!card) return;
  const slides = [...card.querySelectorAll('.slide')];
  const segs = [...card.querySelectorAll('.seg')];
  let cur = 0;

  const show = (i) => {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s, k) => {
      s.classList.toggle('active', k === cur);
      s.setAttribute('aria-hidden', k !== cur);
    });
    segs.forEach((g, k) => {
      g.classList.remove('on', 'done');
      if (k < cur) g.classList.add('done');
    });
    document.dispatchEvent(new CustomEvent('offer-change', { detail: { tint: slides[cur].dataset.tint } }));
    const g = segs[cur];
    void g.offsetWidth;            // reinicia a animação de progresso
    g.classList.add('on');
  };

  segs.forEach((g, k) => g.addEventListener('click', () => show(k)));

  // o fim da barra de progresso avança para a próxima oferta
  card.addEventListener('animationend', (e) => {
    if (e.animationName === 'fill') show(cur + 1);
  });

  if (slides.length) show(0);
});

/* "Ver": o card se expande em uma folha com foto, título persuasivo e botão de compra */
(() => {
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  let current = null;

  const finalBox = (sheet) => {
    const w = Math.min(440, innerWidth - 32);
    sheet.style.width = w + 'px';
    sheet.style.height = 'auto';
    const h = Math.min(sheet.offsetHeight, innerHeight * 0.92);
    return { w, h, left: (innerWidth - w) / 2, top: Math.max(16, (innerHeight - h) / 2) };
  };
  const setBox = (el, b) => {
    el.style.left = b.left + 'px'; el.style.top = b.top + 'px';
    el.style.width = b.w + 'px'; el.style.height = b.h + 'px';
  };

  const openSheet = (card) => {
    if (current) return;
    const produto = Loja.produtos.find((p) => p.id === card.dataset.id);
    if (!produto) return;
    const { esc } = Loja;
    const isOffer = card.classList.contains('slide');
    const name = produto.nome;
    const title = produto.titulo || 'Peça única, feita para você.';
    const text = produto.descricao || 'Seleção exclusiva do nosso ateliê.';
    const img = card.querySelector('.ph img, .tile img')?.src || '';
    // galeria: a primeira foto é a do card (para a abertura casar), as outras vêm do bucket
    const extras = (produto.fotos || []).slice(1);
    const fotosHtml = `<img src="${esc(img)}" alt="${esc(name)}">` +
      extras.map((f, i) => `<img src="${esc(Loja.fotoUrl(f))}" data-fallback="${esc(Loja.fotoReserva(f))}" alt="${esc(name)} ${i + 2}" loading="lazy">`).join('');
    const total = extras.length + 1;
    const nav = total > 1 ? `
        <button class="gal-arrow prev" aria-label="Foto anterior" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
        <button class="gal-arrow next" aria-label="Próxima foto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
        <div class="gal-dots">${Array.from({ length: total }, (_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>` : '';
    const price = Loja.precoHtml(produto);
    const detalhes = produto.detalhes || '';
    const kickerLine = isOffer ? detalhes : `${name} · ${detalhes.split('·')[1]?.trim() || ''}`;

    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', name);   // setAttribute já trata o texto como literal
    sheet.innerHTML = `
      <button class="sheet-close" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="sheet-photo"><div class="gal">${fotosHtml}</div>${nav}</div>
      <div class="sheet-body">
        <p class="sheet-kicker">${esc(kickerLine)}</p>
        <h3>${esc(title)}</h3>
        <p class="sheet-text">${esc(text)}</p>
        <div class="sheet-price">${price}</div>
        ${produto.vendido ? '<span class="sheet-buy esgotado">Vendido</span>' : '<a href="#" class="sheet-buy">Comprar agora</a>'}
        <p class="sheet-perks">Laudo gemológico · Envio segurado · 7 dias para devolução</p>
      </div>`;
    document.body.append(backdrop, sheet);

    const final = finalBox(sheet);
    const r = card.getBoundingClientRect();
    const start = { left: r.left, top: r.top, w: r.width, h: r.height };
    sheet.style.transition = 'none';
    setBox(sheet, start);
    sheet.style.borderRadius = '28px';
    void sheet.offsetWidth;
    sheet.style.transition = '';
    card.classList.add('is-open');
    if (isOffer) document.getElementById('offers').classList.add('hold');   // pausa o carrossel
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      backdrop.classList.add('in');
      setBox(sheet, final);
      sheet.style.borderRadius = '32px';
      setTimeout(() => sheet.classList.add('show'), 180);
    });
    setTimeout(() => { if (current) sheet.style.overflowY = 'auto'; }, 700);

    current = { card, sheet, backdrop };
    const close = () => closeSheet();
    backdrop.addEventListener('click', close);
    sheet.querySelector('.sheet-close').addEventListener('click', close);
    sheet.querySelector('.sheet-buy').addEventListener('click', (e) => e.preventDefault());

    if (total > 1) {
      const gal = sheet.querySelector('.gal');
      const dots = [...sheet.querySelectorAll('.gal-dots i')];
      const prev = sheet.querySelector('.gal-arrow.prev');
      const next = sheet.querySelector('.gal-arrow.next');
      const atual = () => Math.round(gal.scrollLeft / gal.clientWidth);
      const ir = (i) => gal.scrollTo({ left: Math.max(0, Math.min(total - 1, i)) * gal.clientWidth, behavior: 'smooth' });
      gal.addEventListener('scroll', () => {
        const i = atual();
        dots.forEach((d, k) => d.classList.toggle('on', k === i));
        prev.hidden = i === 0;
        next.hidden = i === total - 1;
      }, { passive: true });
      prev.addEventListener('click', () => ir(atual() - 1));
      next.addEventListener('click', () => ir(atual() + 1));
      dots.forEach((d, k) => d.addEventListener('click', () => ir(k)));
    }
  };

  const closeSheet = () => {
    if (!current) return;
    const { card, sheet, backdrop } = current;
    current = null;
    sheet.classList.remove('show');
    sheet.style.overflowY = 'hidden';
    sheet.scrollTop = 0;
    backdrop.classList.remove('in');
    const r = card.getBoundingClientRect();
    setBox(sheet, { left: r.left, top: r.top, w: r.width, h: r.height });
    sheet.style.borderRadius = '28px';
    // o card volta com fade enquanto a folha encolhe e some por cima dele
    card.style.transition = 'transform .4s cubic-bezier(.34,1.4,.5,1), opacity .5s ease .22s';
    card.classList.remove('is-open');
    sheet.style.opacity = '0';
    setTimeout(() => {
      sheet.remove(); backdrop.remove();
      card.style.transition = '';
      document.getElementById('offers')?.classList.remove('hold');
      document.documentElement.style.overflow = '';
    }, 800);
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.card-foot button');
    if (btn) return openSheet(btn.closest('.card'));
    const buy = e.target.closest('.slide .buy');
    if (buy) { e.preventDefault(); openSheet(buy.closest('.slide')); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  addEventListener('resize', () => { if (current) closeSheet(); });
})();

/* banner: alterna a cena do ateliê (a) e as ofertas coloridas (b), reiniciando as animações a cada volta */
(() => {
  const hero = document.getElementById('hero');
  if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bar = hero.querySelector('.hero-progress i');
  const A = 13200, B = 25700;   // a troca começa um pouco antes do fim, com o conteúdo ainda visível
  const c = hero.classList;
  const wipe = () => {
    c.remove('wipe'); void hero.offsetWidth; c.add('wipe');
    setTimeout(() => c.remove('wipe'), 1600);
  };
  const loop = (first) => {
    if (!first) wipe();
    c.remove('b'); c.add('a', 'run-a');
    setTimeout(() => c.remove('run-b'), 1300);   // só reinicia a parte antiga depois que ela sumiu
    bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    setTimeout(() => {
      wipe(); c.remove('a'); c.add('b', 'run-b');
      setTimeout(() => c.remove('run-a'), 1300);
    }, A);
    setTimeout(loop, A + B);
  };
  loop(true);
})();

/* pesquisa: filtra os cards de pedras e joias pelo nome e pela descrição */
(() => {
  const input = document.getElementById('searchInput');
  const empty = document.getElementById('searchEmpty');
  if (!input) return;
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const groups = [...document.querySelectorAll('.stones, .jewels')];

  input.form?.addEventListener('submit', (e) => e.preventDefault());   // Enter não recarrega a página (sem onsubmit inline, por causa da CSP)

  input.addEventListener('input', () => {
    const q = norm(input.value.trim());
    let total = 0;
    groups.forEach((g) => {
      let hits = 0;
      g.querySelectorAll('.card').forEach((c) => {
        const ok = !q || norm(c.querySelector('h3').textContent + ' ' + c.querySelector('p').textContent).includes(q);
        c.classList.toggle('no-match', !ok);
        if (ok) hits += 1;
      });
      g.classList.toggle('no-match', hits === 0);
      const row = g.querySelector('.row');
      if (row) row.scrollLeft = 0;
      total += hits;
    });
    empty.hidden = total > 0;
  });
})();

toggleBtn.addEventListener('click', () => setOpen(!island.classList.contains('open')));
island.addEventListener('click', (e) => {
  if (!island.classList.contains('open') && !e.target.closest('button,a')) setOpen(true);
});
