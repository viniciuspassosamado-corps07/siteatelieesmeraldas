// Edge Function "limpar-fotos": apaga do bucket "produtos" as fotos de produtos apagados ou trocados.
// Chamada pelo banco (trigger -> pg_net) com o segredo compartilhado no cabeçalho x-limpeza-segredo.
// O segredo mora só no Vault do Supabase; a service role é injetada pelo próprio Supabase na função.
// Nenhuma chave fica neste arquivo.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'produtos';
const MAX_POR_CHAMADA = 200;   // limite de segurança de arquivos por chamada
const MAX_CORPO = 20_000;      // bytes
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// formato do segredo do Vault (2 uuids sem hífens); se um dia trocar o segredo, gere no mesmo formato
const SEGREDO = /^[0-9a-f]{64}$/;
const NOME = /^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(?:webp|jpe?g|png)|\.emptyFolderPlaceholder)$/;

const json = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

const miniatura = (caminho: string) => caminho.replace(/(\.\w+)$/, '-thumb$1');
const ehExemplo = (caminho: string) => caminho.startsWith('exemplo/');

// só aceita exatamente <uuid-do-produto>/<arquivo>, sem "..", dentro da pasta do próprio produto
const caminhoValido = (caminho: string, id: string) => {
  if (caminho.length > 200 || caminho.includes('..')) return false;
  const partes = caminho.split('/');
  return partes.length === 2 && UUID.test(partes[0]) && partes[0] === id && NOME.test(partes[1]);
};

type Fotos = { fotos: string[]; banner: string | null };

// lê { fotos, foto_banner } do corpo; devolve null se vier algo fora do formato
const lerFotos = (v: unknown): Fotos | null => {
  if (v === null || v === undefined) return { fotos: [], banner: null };
  if (typeof v !== 'object') return null;
  const { fotos, foto_banner } = v as { fotos?: unknown; foto_banner?: unknown };
  const lista = fotos ?? [];
  if (!Array.isArray(lista) || lista.length > 50 || !lista.every((f) => typeof f === 'string')) return null;
  if (foto_banner !== null && foto_banner !== undefined && typeof foto_banner !== 'string') return null;
  return { fotos: lista as string[], banner: (foto_banner as string | null | undefined) ?? null };
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { erro: 'metodo' });

  // 1) segredo compartilhado: sem ele (ou errado), nada é lido nem apagado.
  //    Fora do formato, recusa na hora, sem consultar o banco (não deixa ninguém gastar a cota à toa).
  const segredo = req.headers.get('x-limpeza-segredo') ?? '';
  if (!SEGREDO.test(segredo)) return json(401, { erro: 'nao autorizado' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: segredoOk, error: erroSegredo } = await admin.rpc('limpar_fotos_segredo_ok', { s: segredo });
  if (erroSegredo) return json(500, { erro: 'falha ao conferir o segredo' });
  if (segredoOk !== true) return json(401, { erro: 'nao autorizado' });

  // 2) corpo
  const texto = await req.text();
  if (texto.length > MAX_CORPO) return json(413, { erro: 'corpo grande demais' });
  let corpo: Record<string, unknown>;
  try { corpo = JSON.parse(texto); } catch { return json(400, { erro: 'json invalido' }); }
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) return json(400, { erro: 'json invalido' });

  const { evento, id } = corpo;
  if ((evento !== 'DELETE' && evento !== 'UPDATE') || typeof id !== 'string' || !UUID.test(id)) {
    return json(400, { erro: 'evento ou id invalido' });
  }
  const antigo = lerFotos(corpo.antigo);
  const novo = evento === 'UPDATE' ? lerFotos(corpo.novo) : { fotos: [], banner: null };
  if (!antigo || !novo) return json(400, { erro: 'fotos fora do formato' });

  // 3) fotos removidas: antigas menos novas (cada uma com a miniatura) + banner antigo se mudou ou sumiu
  const candidatos = new Set<string>();
  for (const f of antigo.fotos) if (!novo.fotos.includes(f)) { candidatos.add(f); candidatos.add(miniatura(f)); }
  if (antigo.banner && antigo.banner !== novo.banner) { candidatos.add(antigo.banner); candidatos.add(miniatura(antigo.banner)); }

  // exemplo/ nunca é tocado; caminho fora do formato é ignorado (e devolvido em "invalidos"), os válidos seguem
  const ignorados: string[] = [];
  const invalidos: string[] = [];
  const validos = new Set<string>();
  for (const c of candidatos) {
    if (ehExemplo(c)) { ignorados.push(c); continue; }
    if (!caminhoValido(c, id)) { invalidos.push(c); continue; }
    validos.add(c);
  }

  // 4) produto apagado: o que sobrou na pasta <id>/ do bucket também vai
  let avisoPasta: string | undefined;
  if (evento === 'DELETE') {
    const { data: arquivos, error } = await admin.storage.from(BUCKET).list(id, { limit: 1000 });
    if (error) avisoPasta = 'nao foi possivel listar a pasta do produto';
    for (const a of arquivos ?? []) {
      const caminho = `${id}/${a.name}`;
      if (caminhoValido(caminho, id)) validos.add(caminho);
      else invalidos.push(caminho);
    }
  }

  // 5) nunca apaga o que algum produto ainda usa
  const { data: emUso, error: erroUso } = await admin.rpc('fotos_em_uso');
  if (erroUso || !Array.isArray(emUso)) return json(500, { erro: 'falha ao conferir fotos em uso', apagados: 0 });
  const mantidos = [...validos].filter((c) => (emUso as string[]).includes(c));
  const apagar = [...validos].filter((c) => !mantidos.includes(c));

  if (apagar.length > MAX_POR_CHAMADA) return json(400, { erro: 'arquivos demais numa chamada', apagados: 0 });

  // 6) apaga pela API do Storage (apagar a linha em storage.objects por SQL não remove o arquivo)
  let apagados = 0;
  for (let i = 0; i < apagar.length; i += 100) {
    const lote = apagar.slice(i, i + 100);
    const { data, error } = await admin.storage.from(BUCKET).remove(lote);
    if (error) {
      console.error('limpar-fotos: falha ao apagar lote', error.message);
      return json(500, { erro: 'falha ao apagar', apagados });
    }
    apagados += data?.length ?? 0;
  }

  console.log(`limpar-fotos: ${evento} ${id} apagados=${apagados} mantidos=${mantidos.length} ignorados=${ignorados.length} invalidos=${invalidos.length}`);
  return json(200, { evento, apagados, tentados: apagar, mantidos, ignorados, invalidos, aviso: avisoPasta });
});
