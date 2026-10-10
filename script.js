const island = document.getElementById('island');
const toggleBtn = document.getElementById('toggleBtn');

const setOpen = (open) => {
  island.classList.toggle('open', open);
  toggleBtn.setAttribute('aria-expanded', open);
  toggleBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
};

/* ofertas: carrossel automático */
(() => {
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

  show(0);
})();

/* "Ver": o card se expande em uma folha com foto, título persuasivo e botão de compra */
(() => {
  const copy = {
    Esmeralda: ['O verde que hipnotiza.', 'Uma esmeralda de cor profunda e brilho raro. Poucas pessoas terão uma igual.'],
    Safira: ['Azul profundo, valor eterno.', 'A safira que atravessa gerações. Presente que vira herança.'],
    Rubi: ['Paixão em forma de pedra.', 'Vermelho intenso, raridade de verdade. Impossível passar despercebido.'],
    Diamante: ['O brilho que você merece.', 'Lapidação perfeita, pureza absoluta. O diamante que ela nunca vai esquecer.'],
    Ametista: ['Roxo real, presença rara.', 'Uma ametista que transforma qualquer produção em assinatura pessoal.'],
    Topázio: ['Dourado que ilumina tudo.', 'Para quem nasceu para brilhar: um topázio com calor de pôr do sol.'],
    Anel: ['O anel que ela vai lembrar para sempre.', 'Ouro e esmeralda em uma peça feita para marcar o momento mais importante.'],
    Colar: ['Seja o centro das atenções.', 'Uma safira que cai exatamente onde o olhar procura. Elegância sem esforço.'],
    Brincos: ['Brincos que roubam o olhar.', 'Rubis lapidados à mão que acendem o rosto assim que você entra.'],
    Pulseira: ['Cada diamante, um motivo para brilhar.', 'Uma pulseira riviera que combina com tudo e nunca sai de moda.'],
    Pingente: ['Delicadeza que fala mais alto.', 'Uma ametista em formato de gota, leve no pescoço e inesquecível no olhar.'],
    Broche: ['Uma obra de arte para vestir.', 'Ouro trabalhado à mão com topázio central. Peça de colecionador.'],
    'Esmeralda Colombiana': ['Oferta rara: o verde mais cobiçado do mundo.', 'Esmeralda colombiana de 2,41 ct com preço que não vai se repetir. Garanta antes que acabe.'],
    'Colar Safira Real': ['Azul real com desconto de realeza.', 'Safira de 3,10 ct em ouro branco. Uma joia para ser lembrada, agora por muito menos.'],
    'Brincos Rubi Imperial': ['Os brincos que todo mundo vai perguntar onde comprou.', 'Rubis de 1,85 ct em ouro 18k com 20% de desconto. Poucas unidades.'],
    'Pulseira Riviera': ['Diamantes em cada centímetro do seu pulso.', 'A pulseira riviera clássica em ouro branco, com um desconto que raramente aparece.'],
    'Pingente Ametista': ['Roxo que vira assinatura.', 'Ametista de 5,60 ct em prata 925. Delicado, marcante e com preço de oferta.']
  };
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
    const isOffer = card.classList.contains('slide');
    const name = card.querySelector('h3').textContent.trim();
    const [title, text] = copy[name] || ['Peça única, feita para você.', 'Seleção exclusiva do nosso ateliê.'];
    const img = card.querySelector('.ph img, .tile img')?.src || '';
    const price = isOffer
      ? `${card.querySelector('.prices strong').textContent} <s>${card.querySelector('.prices s').textContent}</s>`
      : card.querySelector('.card-foot span').textContent;
    const kickerText = card.querySelector('p').textContent;
    const kickerLine = isOffer ? kickerText : `${name} · ${kickerText.split('·')[1]?.trim() || ''}`;

    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', name);
    sheet.innerHTML = `
      <button class="sheet-close" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="sheet-photo"><img src="${img}" alt="${name}"></div>
      <div class="sheet-body">
        <p class="sheet-kicker">${kickerLine}</p>
        <h3>${title}</h3>
        <p class="sheet-text">${text}</p>
        <div class="sheet-price">${price}</div>
        <a href="#" class="sheet-buy">Comprar agora</a>
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
