/* Folha de produto do painel: novo, editar e apagar. Fotos são comprimidas ao escolher
   e só vão para o bucket quando o dono toca em Salvar. */
import { comprimirImagem } from '../comprimir-imagem.js';
import { esc, caminhoThumb, caminhoDeExemplo, imgDoCaminho, ofertaValida } from './lista.js';
import { MAX_OFERTAS_BANNER } from './config.js';
import { validarProduto, textoPreco, calcularDesconto, lerPreco, dataLocal } from './validacao.js';

const MAX_FOTOS = 8;
const CORES = [
  ['esmeralda', 'Esmeralda', '#12b886'], ['safira', 'Safira', '#2f5df0'], ['rubi', 'Rubi', '#e11d48'],
  ['ametista', 'Ametista', '#9d4edd'], ['topazio', 'Topázio', '#f59e0b'], ['diamante', 'Diamante', '#38a8e0']
];

const nulo = (s) => (String(s ?? '').trim() || null);

/* ---------- alerta de confirmação, no estilo do iOS ---------- */
export const confirmar = ({ titulo, texto, botao, perigo = false }) => new Promise((resolve) => {
  const raiz = document.createElement('div');
  raiz.className = 'alerta-fundo';
  raiz.innerHTML = `<div class="alerta" role="alertdialog" aria-modal="true" aria-labelledby="alertaTitulo" aria-describedby="alertaTexto">
    <h3 id="alertaTitulo">${esc(titulo)}</h3>
    <p id="alertaTexto">${esc(texto)}</p>
    <div class="alerta-botoes">
      <button type="button" data-r="0">Cancelar</button>
      <button type="button" data-r="1" class="${perigo ? 'perigo' : ''}">${esc(botao)}</button>
    </div>
  </div>`;
  const fim = (r) => {
    document.removeEventListener('keydown', tecla, true);
    raiz.classList.remove('on');
    setTimeout(() => raiz.remove(), 250);
    resolve(r);
  };
  const tecla = (ev) => {
    if (ev.key !== 'Escape') return;
    ev.stopImmediatePropagation();
    fim(false);
  };
  raiz.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-r]');
    if (b) fim(b.dataset.r === '1');
  });
  document.addEventListener('keydown', tecla, true);
  document.body.append(raiz);
  requestAnimationFrame(() => { raiz.classList.add('on'); raiz.querySelector('button[data-r="0"]').focus(); });
});

/* ---------- formulário ---------- */
export function criarFormulario({ sb, bucket, obterProdutos, aoSalvar, aoApagar, aviso }) {
  const storage = () => sb.storage.from(bucket);
  /* a ordem vale para todos os produtos juntos (o banner pega as primeiras ofertas): o novo entra por último */
  const proximaOrdem = () => Math.max(0, ...obterProdutos().map((x) => Number(x.ordem) || 0)) + 1;
  let aberto = null;

  const campoHtml = (id, rotulo, valor, extra = '') =>
    `<div class="campo"><label for="f-${id}">${rotulo}</label><input id="f-${id}" name="${id}" value="${esc(valor)}" autocomplete="off" ${extra}><p class="erro-campo" data-erro="${id}" hidden></p></div>`;

  const modelo = (e) => {
    const p = e.produto;
    return `<div class="fundo"></div>
<form class="folha" role="dialog" aria-modal="true" aria-labelledby="folhaTitulo" tabindex="-1" novalidate>
  <header class="folha-topo">
    <button type="button" class="link" data-acao="fechar">Cancelar</button>
    <h2 id="folhaTitulo">${p ? 'Editar produto' : 'Novo produto'}</h2>
    <button type="submit" class="link forte" data-salvar>Salvar</button>
  </header>
  <div class="folha-corpo">
    <p class="erro-geral" data-erro-geral role="alert" hidden></p>

    <section class="grupo">
      <h3 class="grupo-titulo">Fotos</h3>
      <div class="fotos" data-fotos></div>
      <p class="dica">A primeira foto é a principal. Cada foto é comprimida antes de enviar. Até ${MAX_FOTOS} fotos, em JPG, PNG ou WebP.</p>
      <input type="file" data-arquivo accept="image/jpeg,image/png,image/webp" multiple hidden>
    </section>

    <section class="grupo">
      ${campoHtml('nome', 'Nome *', p?.nome ?? '', 'maxlength="120"')}
      <div class="campo">
        <span class="rotulo">Categoria</span>
        <div class="segmentos" data-categoria role="radiogroup" aria-label="Categoria">
          <button type="button" role="radio" data-valor="pedra" aria-checked="${e.categoria === 'pedra'}">Pedra preciosa</button>
          <button type="button" role="radio" data-valor="joia" aria-checked="${e.categoria === 'joia'}">Joia exclusiva</button>
        </div>
      </div>
      ${campoHtml('titulo', 'Título persuasivo', p?.titulo ?? '', 'maxlength="160" placeholder="Ex.: O verde que hipnotiza."')}
      <div class="campo"><label for="f-descricao">Descrição</label><textarea id="f-descricao" name="descricao" rows="3" maxlength="2000">${esc(p?.descricao ?? '')}</textarea></div>
      ${campoHtml('detalhes', 'Detalhes', p?.detalhes ?? '', 'maxlength="160" placeholder="Ex.: Esmeralda · 2,41 ct"')}
      <div class="campo">
        <span class="rotulo">Cor</span>
        <div class="cores" data-cores role="radiogroup" aria-label="Cor">
          ${CORES.map(([v, nome, hex]) => `<button type="button" role="radio" data-valor="${v}" aria-checked="${e.cor === v}"><i style="background:${hex}"></i>${nome}</button>`).join('')}
        </div>
      </div>
    </section>

    <section class="grupo">
      <div class="linha-interruptor">
        <div><strong>Adicionar como oferta</strong><span>Aparece no banner e no carrossel de ofertas</span></div>
        <button type="button" class="switch" role="switch" data-oferta aria-label="Adicionar como oferta" aria-checked="${e.oferta}"><i></i></button>
      </div>
      <div data-bloco-normal ${e.oferta ? 'hidden' : ''}>
        ${campoHtml('preco', 'Preço (R$) *', e.valores.preco, 'inputmode="decimal" placeholder="0,00"')}
      </div>
      <div data-bloco-oferta ${e.oferta ? '' : 'hidden'}>
        <p class="aviso-oferta" data-aviso-oferta role="status" hidden>O banner mostra no máximo ${MAX_OFERTAS_BANNER} ofertas. Esta aparecerá só na fileira.</p>
        ${campoHtml('precoOferta', 'Preço da oferta (R$) *', e.valores.precoOferta, 'inputmode="decimal" placeholder="0,00"')}
        ${campoHtml('precoOriginal', 'Preço original (R$) *', e.valores.precoOriginal, 'inputmode="decimal" placeholder="0,00"')}
        <p class="desconto" data-desconto></p>
        ${campoHtml('termino', 'Término da oferta (opcional)', e.valores.termino, 'type="date"')}
      </div>
    </section>

    <section class="grupo">
      ${campoHtml('estoque', 'Estoque *', e.valores.estoque, 'inputmode="numeric"')}
      <p class="dica">Com estoque 0, o produto aparece como Vendido na loja.</p>
      <div class="linha-interruptor">
        <div><strong>Visível na loja</strong><span>Desligado, o produto fica escondido do público</span></div>
        <button type="button" class="switch" role="switch" data-ativo aria-label="Visível na loja" aria-checked="${e.ativo}"><i></i></button>
      </div>
    </section>

    ${p ? '<section class="grupo"><button type="button" class="apagar" data-acao="apagar">Apagar produto</button></section>' : ''}
  </div>
</form>`;
  };

  function abrir(produto = null) {
    if (aberto) return;
    const ofertaLigada = Boolean(produto?.oferta);
    const e = {
      produto,
      id: produto?.id ?? crypto.randomUUID(),
      categoria: produto?.categoria ?? 'pedra',
      cor: produto?.cor ?? null,
      ativo: produto?.ativo ?? true,
      oferta: ofertaLigada,
      valores: {
        // com oferta, preco guarda o preço da oferta e preco_original o preço normal
        preco: textoPreco(ofertaLigada ? produto.preco_original : produto?.preco),
        precoOferta: ofertaLigada ? textoPreco(produto.preco) : '',
        precoOriginal: ofertaLigada ? textoPreco(produto.preco_original) : '',
        termino: dataLocal(produto?.oferta_ate),
        estoque: String(produto?.estoque ?? 1)
      },
      fotos: (produto?.fotos ?? []).map((caminho, i) => ({ fid: `x${i}`, estado: 'salva', caminho })),
      fotosOriginais: [...(produto?.fotos ?? [])],
      sujo: false,
      ocupado: false,
      contador: 0
    };
    aberto = e;

    const raiz = document.createElement('div');
    raiz.className = 'folha-raiz';
    raiz.innerHTML = modelo(e);
    document.body.append(raiz);
    document.documentElement.style.overflow = 'hidden';
    const $ = (s) => raiz.querySelector(s);
    const form = $('.folha');
    const campo = (nome) => raiz.querySelector(`#f-${nome}`);

    /* ----- fotos ----- */
    const desenharFotos = () => {
      const tiles = e.fotos.map((f, i) => {
        const imagem = f.estado === 'comprimindo'
          ? '<span class="girando" aria-label="Comprimindo"></span>'
          : f.caminho ? imgDoCaminho(f.caminho) : `<img src="${esc(f.url)}" alt="">`;
        return `<div class="foto" data-fid="${f.fid}">
          <div class="foto-img">${imagem}${i === 0 ? '<span class="selo">Principal</span>' : ''}</div>
          <div class="foto-acoes">
            ${i > 0 ? '<button type="button" data-acao="principal">Principal</button>' : ''}
            <button type="button" data-acao="remover-foto">Remover</button>
          </div>
          ${f.resumo ? `<span class="foto-info">${esc(f.resumo)}</span>` : ''}
        </div>`;
      });
      if (e.fotos.length < MAX_FOTOS) tiles.push('<button type="button" class="foto-add" data-acao="add-foto"><b>+</b>Foto</button>');
      $('[data-fotos]').innerHTML = tiles.join('');
    };

    const adicionarFotos = async (arquivos) => {
      for (const arquivo of [...arquivos]) {
        if (e.fotos.length >= MAX_FOTOS) { aviso(`No máximo ${MAX_FOTOS} fotos por produto.`); break; }
        const f = { fid: `n${++e.contador}`, estado: 'comprimindo' };
        e.fotos.push(f);
        e.sujo = true;
        desenharFotos();
        try {
          const r = await comprimirImagem(arquivo);
          if (aberto !== e) return;
          Object.assign(f, { estado: 'pronta', full: r.full, thumb: r.thumb, extFull: r.extFull, url: URL.createObjectURL(r.thumb), resumo: r.resumo });
        } catch (err) {
          if (aberto !== e) return;
          e.fotos.splice(e.fotos.indexOf(f), 1);
          aviso(`${arquivo.name}: ${err instanceof Error ? err.message : 'não foi possível preparar a foto.'}`);
        }
        desenharFotos();
      }
    };

    /* ----- oferta e desconto ----- */
    const atualizarDesconto = () => {
      const oferta = lerPreco(campo('precoOferta').value);
      const original = lerPreco(campo('precoOriginal').value);
      const d = calcularDesconto(oferta, original);
      $('[data-desconto]').textContent = d == null ? 'Desconto: preencha os dois preços' : `Desconto calculado: -${d}%`;
    };

    /* o banner pega as primeiras ofertas, na ordem de exibição; avisa quando esta ficaria depois do limite */
    const atualizarAvisoOferta = () => {
      const todos = obterProdutos();
      const ordem = e.produto ? Number(e.produto.ordem) || 0 : proximaOrdem();
      const semEstoque = campo('estoque').value.trim() !== '' && Number(campo('estoque').value) === 0;
      const antes = todos.filter((x) => x.id !== e.id && x.ativo && Number(x.estoque) > 0 && ofertaValida(x) && (Number(x.ordem) || 0) <= ordem).length;
      $('[data-aviso-oferta]').hidden = !(e.oferta && e.ativo && !semEstoque && antes >= MAX_OFERTAS_BANNER);
    };

    const alternarOferta = () => {
      if (!e.oferta) {
        if (!campo('precoOriginal').value) campo('precoOriginal').value = campo('preco').value;   // o preço normal vira o original
      } else if (campo('precoOriginal').value) {
        campo('preco').value = campo('precoOriginal').value;                                         // desligar volta ao preço normal
      }
      e.oferta = !e.oferta;
      $('[data-oferta]').setAttribute('aria-checked', e.oferta);
      $('[data-bloco-normal]').hidden = e.oferta;
      $('[data-bloco-oferta]').hidden = !e.oferta;
      limparErros();
      atualizarDesconto();
      atualizarAvisoOferta();
    };

    /* ----- erros ----- */
    const limparErros = () => {
      raiz.querySelectorAll('[data-erro]').forEach((p) => { p.hidden = true; p.textContent = ''; });
      raiz.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
      const geral = $('[data-erro-geral]');
      geral.hidden = true;
      geral.textContent = '';
    };
    const mostrarErros = (erros) => {
      limparErros();
      for (const [chave, texto] of Object.entries(erros)) {
        const p = raiz.querySelector(`[data-erro="${chave}"]`);
        if (p) { p.textContent = texto; p.hidden = false; }
        campo(chave)?.setAttribute('aria-invalid', 'true');
      }
      const primeiro = campo(Object.keys(erros)[0]);
      primeiro?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      primeiro?.focus({ preventScroll: true });
    };
    const erroGeral = (texto) => {
      const geral = $('[data-erro-geral]');
      geral.textContent = texto;
      geral.hidden = false;
      $('.folha-corpo').scrollTo({ top: 0, behavior: 'smooth' });
    };

    /* ----- fechar ----- */
    const encerrar = () => {
      document.removeEventListener('keydown', aoTeclar);
      document.documentElement.style.overflow = '';
      e.fotos.forEach((f) => f.url && URL.revokeObjectURL(f.url));
      aberto = null;
      raiz.querySelector('.fundo').classList.remove('on');
      form.classList.remove('on');
      setTimeout(() => raiz.remove(), 450);
    };
    const fechar = async () => {
      if (e.ocupado) return;
      if (e.sujo && !(await confirmar({ titulo: 'Descartar alterações?', texto: 'O que você preencheu será perdido.', botao: 'Descartar', perigo: true }))) return;
      encerrar();
    };
    const aoTeclar = (ev) => { if (ev.key === 'Escape') fechar(); };
    document.addEventListener('keydown', aoTeclar);

    const ocupar = (sim, texto = 'Salvar') => {
      e.ocupado = sim;
      form.classList.toggle('ocupado', sim);
      $('[data-salvar]').textContent = texto;
      $('[data-salvar]').disabled = sim;
    };

    /* ----- salvar ----- */
    const dados = () => ({
      nome: campo('nome').value,
      oferta: e.oferta,
      preco: campo('preco').value,
      precoOferta: campo('precoOferta').value,
      precoOriginal: campo('precoOriginal').value,
      estoque: campo('estoque').value,
      termino: campo('termino').value
    });

    const salvar = async () => {
      if (e.ocupado) return;
      limparErros();
      const { erros, valores } = validarProduto(dados());
      if (!valores) return mostrarErros(erros);
      if (e.fotos.some((f) => f.estado === 'comprimindo')) return erroGeral('Aguarde as fotos terminarem de ser preparadas.');

      ocupar(true, 'Salvando…');
      const enviados = [];
      try {
        const bucketAtual = storage();
        let n = 0;
        for (const f of e.fotos) {
          if (f.caminho) continue;
          const caminho = `${e.id}/${Date.now()}-${++n}.${f.extFull}`;
          const miniatura = caminhoThumb(caminho);
          for (const [destino, blob] of [[caminho, f.full], [miniatura, f.thumb]]) {
            const { error } = await bucketAtual.upload(destino, blob, { contentType: blob.type, cacheControl: '31536000' });
            if (error) throw error;
            enviados.push(destino);
          }
          f.caminho = caminho;
        }
        const fotos = e.fotos.map((f) => f.caminho);

        const linha = {
          ...valores,
          categoria: e.categoria,
          titulo: nulo(campo('titulo').value),
          descricao: nulo(campo('descricao').value),
          detalhes: nulo(campo('detalhes').value),
          cor: e.cor,
          ativo: e.ativo,
          fotos
        };

        let consulta;
        if (e.produto) {
          consulta = sb.from('produtos').update(linha).eq('id', e.id);
        } else {
          consulta = sb.from('produtos').insert({ id: e.id, ...linha, ordem: proximaOrdem() });
        }
        const { data, error } = await consulta.select().single();
        if (error) throw error;

        const removidas = e.fotosOriginais.filter((c) => !fotos.includes(c) && !caminhoDeExemplo(c));
        if (removidas.length) await bucketAtual.remove(removidas.flatMap((c) => [c, caminhoThumb(c)]));

        aoSalvar(data, !e.produto);
        e.sujo = false;
        encerrar();
      } catch (err) {
        console.warn('Falha ao salvar o produto:', err?.code ?? err?.name ?? 'erro');
        if (enviados.length) await storage().remove(enviados).catch(() => {});
        e.fotos.forEach((f) => { if (f.full) delete f.caminho; });   // as novas voltam a "pendentes" para tentar de novo
        ocupar(false);
        erroGeral(err?.code === '42501' ? 'Sem permissão para salvar. Entre de novo no painel.' : 'Não foi possível salvar. Confira a conexão e tente de novo.');
      }
    };

    /* ----- apagar ----- */
    const apagar = async () => {
      const ok = await confirmar({ titulo: 'Apagar este produto?', texto: 'Isso não pode ser desfeito.', botao: 'Apagar', perigo: true });
      if (!ok) return;
      ocupar(true, 'Apagando…');
      const { data, error } = await sb.from('produtos').delete().eq('id', e.id).select('id');
      if (error || !data?.length) {
        console.warn('Falha ao apagar o produto:', error?.code ?? 'sem resposta');
        ocupar(false);
        return erroGeral('Não foi possível apagar o produto. Tente de novo.');
      }
      const caminhos = new Set();
      const { data: arquivos } = await storage().list(e.id, { limit: 1000 });
      (arquivos ?? []).forEach((a) => caminhos.add(`${e.id}/${a.name}`));
      e.fotosOriginais.filter((c) => !caminhoDeExemplo(c)).forEach((c) => { caminhos.add(c); caminhos.add(caminhoThumb(c)); });
      let sobrou = false;
      if (caminhos.size) {
        const { error: erroFotos } = await storage().remove([...caminhos]);
        sobrou = Boolean(erroFotos);
      }
      aoApagar(e.id);
      e.sujo = false;
      encerrar();
      if (sobrou) aviso('Produto apagado, mas algumas fotos não puderam ser removidas.');
    };

    /* ----- eventos ----- */
    form.addEventListener('submit', (ev) => { ev.preventDefault(); salvar(); });
    form.addEventListener('input', (ev) => {
      e.sujo = true;
      const alvo = ev.target;
      if (alvo.id?.startsWith('f-')) {
        alvo.removeAttribute('aria-invalid');
        const msg = raiz.querySelector(`[data-erro="${alvo.name}"]`);
        if (msg) msg.hidden = true;
      }
      if (alvo.id === 'f-precoOferta' || alvo.id === 'f-precoOriginal') atualizarDesconto();
      if (alvo.id === 'f-estoque') atualizarAvisoOferta();
    });
    form.addEventListener('click', (ev) => {
      const alvo = ev.target;
      const acao = alvo.closest('[data-acao]')?.dataset.acao;
      const fid = alvo.closest('[data-fid]')?.dataset.fid;
      if (acao === 'fechar') fechar();
      else if (acao === 'apagar') apagar();
      else if (acao === 'add-foto') { $('[data-arquivo]').value = ''; $('[data-arquivo]').click(); }
      else if (acao === 'remover-foto') {
        const i = e.fotos.findIndex((f) => f.fid === fid);
        if (i >= 0) { const [f] = e.fotos.splice(i, 1); if (f.url) URL.revokeObjectURL(f.url); e.sujo = true; desenharFotos(); }
      } else if (acao === 'principal') {
        const i = e.fotos.findIndex((f) => f.fid === fid);
        if (i > 0) { e.fotos.unshift(...e.fotos.splice(i, 1)); e.sujo = true; desenharFotos(); }
      } else if (alvo.closest('[data-oferta]')) { alternarOferta(); e.sujo = true; }
      else if (alvo.closest('[data-ativo]')) {
        e.ativo = !e.ativo;
        $('[data-ativo]').setAttribute('aria-checked', e.ativo);
        e.sujo = true;
        atualizarAvisoOferta();
      } else if (alvo.closest('[data-categoria] button')) {
        e.categoria = alvo.closest('button').dataset.valor;
        raiz.querySelectorAll('[data-categoria] button').forEach((b) => b.setAttribute('aria-checked', b.dataset.valor === e.categoria));
        e.sujo = true;
        atualizarAvisoOferta();
      } else if (alvo.closest('[data-cores] button')) {
        const valor = alvo.closest('button').dataset.valor;
        e.cor = e.cor === valor ? null : valor;   // tocar de novo na cor escolhida limpa a escolha
        raiz.querySelectorAll('[data-cores] button').forEach((b) => b.setAttribute('aria-checked', b.dataset.valor === e.cor));
        e.sujo = true;
      }
    });
    $('[data-arquivo]').addEventListener('change', (ev) => adicionarFotos(ev.target.files));

    desenharFotos();
    atualizarDesconto();
    atualizarAvisoOferta();
    requestAnimationFrame(() => {
      raiz.querySelector('.fundo').classList.add('on');
      form.classList.add('on');
      form.focus({ preventScroll: true });
    });
  }

  return { abrir };
}
