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
        <p class="sheet-perks">Nota fiscal · Envio segurado · 7 dias para devolução</p>
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
  const A = 13200;
  // a parte das ofertas dura 5s por tomada (+0,7s de folga); o número de tomadas vem do banco, então é lido a cada volta
  const tomadas = () => document.querySelectorAll('#dealsBanner .ob-slide').length;
  const duracaoB = () => (tomadas() || 5) * 5000 + 700;
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
    bar.style.animationDuration = (A + duracaoB()) / 1000 + 's';
    setTimeout(() => {
      if (!tomadas()) return loop(true);   // banner sem produtos: a cena do ateliê continua sozinha
      wipe(); c.remove('a'); c.add('b', 'run-b');
      setTimeout(() => c.remove('run-a'), 1300);
      setTimeout(loop, duracaoB());
    }, A);
  };
  loop(true);
})();

/* "Do ateliê até a sua casa": a linha passa por trás dos ícones.
   No desktop ela se desenha sozinha quando a seção aparece; no celular acompanha o rolar da página. */
(() => {
  const box = document.getElementById('journey');
  if (!box) return;
  const secao = box.closest('.journey');
  const steps = [...box.querySelectorAll('.step')];
  const desktop = matchMedia('(min-width:900px)');
  const parado = matchMedia('(prefers-reduced-motion: reduce)');
  const lim = [];                       // ponto da linha (0 a 1) em que cada etapa acende
  let railTop = 0, railLen = 1;         // trilho do celular: do centro do 1º ao centro do último ícone
  let prog = 0, tocou = false;          // progresso e estado da animação do desktop
  secao.classList.add('js');

  const aplicar = (raw) => {
    box.style.setProperty('--p', Math.min(1, Math.max(0, raw)));
    steps.forEach((s, i) => s.classList.toggle('on', raw >= lim[i]));
  };

  const medir = () => {
    const b = box.getBoundingClientRect();
    if (desktop.matches) {
      steps.forEach((s, i) => { const r = s.getBoundingClientRect(); lim[i] = (r.left + r.width / 2 - b.left) / b.width - 0.02; });
      return;
    }
    const c = steps.map((s) => { const r = s.querySelector('.step-ic').getBoundingClientRect(); return r.top + r.height / 2 - b.top; });
    railTop = c[0];
    railLen = Math.max(1, c[c.length - 1] - c[0]);
    c.forEach((y, i) => { lim[i] = (y - railTop) / railLen; });
    box.style.setProperty('--rail-top', railTop + 'px');
    box.style.setProperty('--rail-h', railLen + 'px');
  };

  const atualizar = () => {
    if (parado.matches) return aplicar(2);   // sem animação: tudo aceso
    if (desktop.matches) return aplicar(prog);
    // celular: a ponta da linha fica um pouco abaixo do meio da tela
    aplicar((innerHeight * 0.62 - (box.getBoundingClientRect().top + railTop)) / railLen);
  };

  let agendado = false;
  addEventListener('scroll', () => {
    if (desktop.matches || agendado) return;
    agendado = true;
    requestAnimationFrame(() => { agendado = false; atualizar(); });
  }, { passive: true });
  const remedir = () => { medir(); atualizar(); };
  addEventListener('resize', remedir);
  addEventListener('load', remedir);
  desktop.addEventListener('change', () => { if (desktop.matches && !tocou) { tocou = true; prog = 1; } remedir(); });

  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || tocou || !desktop.matches) return;
    tocou = true; io.disconnect();
    if (parado.matches) { prog = 1; return atualizar(); }
    const t0 = performance.now(), D = 3400;
    const passo = (t) => {
      const x = Math.min(1, (t - t0) / D);
      prog = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;   // começa e termina devagar
      atualizar();
      if (x < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }, { threshold: 0.45 });
  io.observe(box);

  remedir();
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

/* contato: o que o visitante digita vai pronto para a conversa do WhatsApp */
(() => {
  const msg = document.getElementById('contatoMsg');
  const btn = document.getElementById('contatoBtn');
  if (!msg || !btn) return;
  const base = 'https://wa.me/5511963799306?text=';
  const padrao = 'Olá! Vim pelo site do Ateliê das Esmeraldas e gostaria de atendimento.';
  const atualizar = () => { btn.href = base + encodeURIComponent(msg.value.trim() || padrao); };
  msg.addEventListener('input', atualizar);
  atualizar();
})();

/* "Crie a sua joia": passo a passo da encomenda; no fim, o pedido vai pronto para o WhatsApp do ateliê */
(() => {
  const card = document.getElementById('encCard');
  if (!card) return;
  const $ = (s) => card.querySelector(s);
  const etapas = [...card.querySelectorAll('.enc-etapa')];
  const TOTAL = 5;   // a 6ª etapa é o resumo
  const est = { peca: '', metal: '', pedra: '', par: 'Par', prazo: '', orcamento: '' };
  let atual = 1;

  const campo = {
    aro1: $('#encAro1'), aro2: $('#encAro2'), naoSei: $('#encNaoSeiAro'),
    gravacao: $('#encGravacao'), ideia: $('#encIdeia'), data: $('#encData')
  };
  const erro = $('#encErro');
  const voltar = document.getElementById('encVoltar');
  const avancar = document.getElementById('encAvancar');
  const ehAlianca = () => est.peca === 'Aliança';

  const mostrarErro = (texto = '') => { erro.hidden = !texto; erro.textContent = texto; };

  /* ajusta o passo 4 conforme a peça (aliança tem aro e gravação) e o par/uma */
  const ajustarDetalhes = () => {
    $('[data-so="alianca"]').hidden = !ehAlianca();
    const par = est.par === 'Par';
    $('[data-aro2]').hidden = !par;
    $('[data-rotulo-aro1]').textContent = par ? 'Aro 1' : 'Aro';
    campo.aro1.disabled = campo.aro2.disabled = campo.naoSei.checked;
    $('[data-rotulo-ideia]').textContent = ehAlianca() ? 'Algum detalhe a mais? (opcional)' : 'Descreva sua ideia';
  };

  const irPara = (n) => {
    atual = n;
    mostrarErro();
    etapas.forEach((f) => { f.hidden = Number(f.dataset.etapa) !== n; });
    $('#encPasso').textContent = n > TOTAL ? 'Tudo pronto' : `Passo ${n} de ${TOTAL}`;
    $('#encBarra').style.width = `${(Math.min(n, TOTAL + 1) - 1) / TOTAL * 100}%`;
    voltar.hidden = n === 1;
    avancar.hidden = n > TOTAL;
    avancar.textContent = n === TOTAL ? 'Ver meu pedido' : 'Continuar';
    if (n === 4) ajustarDetalhes();
    if (n > TOTAL) montarResumo();
    const atualEl = etapas.find((f) => !f.hidden);
    atualEl?.querySelector('legend')?.focus({ preventScroll: true });
    const topo = card.getBoundingClientRect().top;
    if (topo < 70 || topo > innerHeight * 0.6) card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const aroValido = (v) => !v || (/^\d{1,2}$/.test(v) && Number(v) >= 5 && Number(v) <= 35);

  const validar = () => {
    if (atual === 1 && !est.peca) return 'Escolha a peça para continuar.';
    if (atual === 2 && !est.metal) return 'Escolha o metal (ou "Ainda não sei").';
    if (atual === 3 && !est.pedra) return 'Escolha a pedra (ou "Sem pedra").';
    if (atual === 4) {
      if (ehAlianca() && !campo.naoSei.checked) {
        if (!aroValido(campo.aro1.value.trim()) || (est.par === 'Par' && !aroValido(campo.aro2.value.trim()))) return 'O aro é um número entre 5 e 35. Se não souber, marque "Ainda não sei".';
      }
      if (!ehAlianca() && !campo.ideia.value.trim()) return 'Conte um pouco da sua ideia para o ateliê.';
    }
    if (atual === 5) {
      if (!est.prazo) return 'Escolha o prazo.';
      if (est.prazo === 'Tenho uma data') {
        const [a, m, d] = campo.data.value.split('-').map(Number);
        if (!a || new Date(a, m - 1, d) < hoje()) return 'Escolha uma data a partir de hoje.';
      }
    }
    return '';
  };

  /* as linhas do pedido (usadas no resumo e na mensagem do WhatsApp) */
  const linhas = () => {
    const l = [];
    if (ehAlianca()) l.push(['Peça', est.par === 'Par' ? 'Par de alianças' : 'Uma aliança']);
    else l.push(['Peça', est.peca]);
    l.push(['Metal', est.metal], ['Pedra', est.pedra]);
    if (ehAlianca()) {
      const a1 = campo.aro1.value.trim(); const a2 = campo.aro2.value.trim();
      if (campo.naoSei.checked) l.push(['Aro', 'Ainda não sei (preciso de ajuda para medir)']);
      else if (est.par === 'Par' && (a1 || a2)) l.push(['Aros', `${a1 || '?'} e ${a2 || '?'}`]);
      else if (a1) l.push(['Aro', a1]);
      const g = campo.gravacao.value.trim();
      if (g) l.push(['Gravação', `"${g}"`]);
    }
    const ideia = campo.ideia.value.trim();
    if (ideia) l.push([ehAlianca() ? 'Detalhes' : 'Ideia', ideia]);
    if (est.prazo === 'Tenho uma data') l.push(['Prazo', `Até ${campo.data.value.split('-').reverse().join('/')}`]);
    else l.push(['Prazo', est.prazo]);
    if (est.orcamento) l.push(['Orçamento', est.orcamento]);
    return l;
  };

  const montarResumo = () => {
    const resumo = $('#encResumo');
    resumo.replaceChildren(...linhas().map(([k, v]) => {
      const div = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      div.append(dt, dd);
      return div;
    }));
    const texto = ['*Pedido de joia personalizada* (pelo site)', '', ...linhas().map(([k, v]) => `• ${k}: ${v}`)].join('\n');
    $('#encEnviar').href = 'https://wa.me/5511963799306?text=' + encodeURIComponent(texto);
  };

  /* escolhas (botões de opção) */
  card.addEventListener('click', (e) => {
    const b = e.target.closest('.enc-opcoes button[data-v]');
    if (!b) return;
    const grupo = b.closest('[data-campo]');
    const nome = grupo.dataset.campo;
    const repetido = est[nome] === b.dataset.v;
    est[nome] = b.dataset.v;
    grupo.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    mostrarErro();
    if (nome === 'par') ajustarDetalhes();
    if (nome === 'prazo') {
      $('[data-bloco-data]').hidden = est.prazo !== 'Tenho uma data';
      if (est.prazo === 'Tenho uma data') campo.data.min = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    }
    /* nos passos de uma escolha só, segue sozinho */
    if (atual <= 3 && !repetido) setTimeout(() => { if (atual <= 3 && est[nome] === b.dataset.v) irPara(atual + 1); }, 280);
  });
  campo.naoSei.addEventListener('change', ajustarDetalhes);
  [campo.aro1, campo.aro2].forEach((i) => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 2); }));

  avancar.addEventListener('click', () => {
    const msg = validar();
    if (msg) return mostrarErro(msg);
    irPara(atual + 1);
  });
  voltar.addEventListener('click', () => irPara(Math.max(1, atual - 1)));
  $('#encRecomecar').addEventListener('click', () => {
    Object.assign(est, { peca: '', metal: '', pedra: '', par: 'Par', prazo: '', orcamento: '' });
    card.querySelectorAll('.enc-opcoes button').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.v === 'Par')));
    Object.values(campo).forEach((c) => { if (c.type === 'checkbox') c.checked = false; else c.value = ''; });
    $('[data-bloco-data]').hidden = true;
    irPara(1);
  });
})();

/* dock fixo: atalhos, ponto na seção atual, número de ofertas e recolhe ao rolar para baixo */
(() => {
  const dock = document.getElementById('dock');
  if (!dock) return;
  const suave = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  /* links internos com rolagem suave (o menu do topo cobre ~80px) */
  dock.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a) {
      const alvo = document.querySelector(a.getAttribute('href'));
      if (!alvo) return;
      e.preventDefault();
      alvo.scrollIntoView({ behavior: suave(), block: 'start' });
      return;
    }
    if (e.target.closest('[data-dock="busca"]')) {
      const campo = document.getElementById('searchInput');
      if (!campo) return;
      campo.focus({ preventScroll: true });
      campo.closest('form').scrollIntoView({ behavior: suave(), block: 'center' });
    }
  });

  /* "Ofertas": bolinha com quantas há; sem ofertas, o atalho some */
  const itemOfertas = dock.querySelector('[data-dock="ofertas"]');
  window.Loja?.pronto?.then(() => {
    const n = Loja.selecionar(Loja.produtos).carrossel.length;
    itemOfertas.hidden = n === 0;
    const badge = itemOfertas.querySelector('.dock-badge');
    badge.hidden = n === 0;
    badge.textContent = String(n);
    itemOfertas.setAttribute('aria-label', n ? `Ofertas (${n})` : 'Ofertas');
  });

  /* ponto embaixo do atalho da seção em que a pessoa está */
  const secoes = [['encomenda', '#encomenda'], ['ofertas', '#ofertas'], ['whats', '.contato']]
    .map(([id, sel]) => [dock.querySelector(`[data-dock="${id}"]`), document.querySelector(sel)])
    .filter(([item, el]) => item && el);
  if ('IntersectionObserver' in window) {
    const visiveis = new Set();
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => (en.isIntersecting ? visiveis.add(en.target) : visiveis.delete(en.target)));
      secoes.forEach(([item, el]) => item.classList.toggle('on', visiveis.has(el)));
    }, { rootMargin: '-45% 0px -45% 0px' });
    secoes.forEach(([, el]) => io.observe(el));
  }

  /* recolhe ao rolar para baixo e volta ao rolar para cima (ou perto do fim da página) */
  let ultimo = scrollY;
  let pedido = false;
  addEventListener('scroll', () => {
    if (pedido) return;
    pedido = true;
    requestAnimationFrame(() => {
      pedido = false;
      const y = scrollY;
      const noFim = innerHeight + y >= document.documentElement.scrollHeight - 80;
      if (y > ultimo + 8 && y > 240 && !noFim) dock.classList.add('recolhido');
      else if (y < ultimo - 8 || noFim || y <= 240) dock.classList.remove('recolhido');
      ultimo = y;
    });
  }, { passive: true });
  /* quem navega pelo teclado nunca fica com o dock escondido */
  dock.addEventListener('focusin', () => dock.classList.remove('recolhido'));
})();

toggleBtn.addEventListener('click', () => setOpen(!island.classList.contains('open')));
island.addEventListener('click', (e) => {
  if (!island.classList.contains('open') && !e.target.closest('button,a')) setOpen(true);
});
