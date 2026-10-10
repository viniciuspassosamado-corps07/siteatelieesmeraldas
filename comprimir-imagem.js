/* Compressão de fotos no navegador, antes do upload.
   O painel admin chama comprimirImagem(arquivo) e envia os dois blobs ao Supabase Storage:
   uma versão para a folha do produto e uma miniatura para os cards. Sai em WebP (mantém transparência). */

const PADRAO = { maxLado: 1600, thumbLado: 500, qualidade: 0.82, qualidadeThumb: 0.78 };

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

async function abrir(arquivo) {
  // imageOrientation corrige fotos de celular que vêm "deitadas" pelo EXIF
  return createImageBitmap(arquivo, { imageOrientation: 'from-image' });
}

function paraBlob(canvas, tipo, qualidade) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem'))), tipo, qualidade);
  });
}

async function redimensionar(bitmap, maxLado, qualidade, tipoOriginal) {
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, largura, altura);   // fundo continua transparente

  let blob = await paraBlob(canvas, 'image/webp', qualidade);
  if (blob.type !== 'image/webp') {
    // navegador sem codificação WebP: PNG mantém a transparência, JPEG serve para fotos comuns
    blob = tipoOriginal === 'image/png'
      ? await paraBlob(canvas, 'image/png')
      : await paraBlob(canvas, 'image/jpeg', qualidade);
  }
  return { blob, largura, altura };
}

const extensao = (tipo) => (tipo === 'image/webp' ? 'webp' : tipo === 'image/png' ? 'png' : 'jpg');

export const formatarTamanho = (bytes) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * @param {File} arquivo  foto escolhida pelo dono
 * @param {object} opcoes  maxLado, thumbLado, qualidade, qualidadeThumb
 * @returns {Promise<{full: Blob, thumb: Blob, extFull: string, extThumb: string,
 *                    largura: number, altura: number, antes: number, depois: number, resumo: string}>}
 */
export async function comprimirImagem(arquivo, opcoes = {}) {
  const o = { ...PADRAO, ...opcoes };
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new Error('Formato não aceito. Use JPG, PNG ou WebP.');
  }

  const bitmap = await abrir(arquivo);
  try {
    const full = await redimensionar(bitmap, o.maxLado, o.qualidade, arquivo.type);
    const thumb = await redimensionar(bitmap, o.thumbLado, o.qualidadeThumb, arquivo.type);
    const antes = arquivo.size;
    const depois = full.blob.size;
    return {
      full: full.blob,
      thumb: thumb.blob,
      extFull: extensao(full.blob.type),
      extThumb: extensao(thumb.blob.type),
      largura: full.largura,
      altura: full.altura,
      antes,
      depois,
      resumo: `${formatarTamanho(antes)} → ${formatarTamanho(depois)}`
    };
  } finally {
    bitmap.close();
  }
}
