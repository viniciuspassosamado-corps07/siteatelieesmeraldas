/* RippleDistortion (React Bits) em JS puro, sem imagem de fundo e sem mouse.
   As ondas (shader original) são lançadas sozinhas, num vai e volta contínuo
   que sai da tela pela direita e pela esquerda, e a cor acompanha o produto. */
const mount = document.getElementById('offersFx');

const P = {
  brushSize: 150,
  rings: 4,
  spread: 5,
  fade: 2.6,
  spacing: 5,         // trilha densa = movimento contínuo, sem "pulinhos"
  quality: 'medium',
  alpha: 0.5          // opacidade máxima da água colorida
};

const MAX_WAVES = 220;
const QUALITY_SCALE = { low: 0.4, medium: 0.7, high: 1 };
const START_SCALE = 1.5;
const LIFE_CONSTANT = Math.log(500);

const waveVertex = `
precision highp float;

attribute vec2 position;
attribute vec2 uv;
attribute vec2 iOffset;
attribute vec2 iScale;
attribute float iOpacity;

varying vec2 vUv;
varying float vOpacity;

void main() {
  vUv = uv;
  vOpacity = iOpacity;
  gl_Position = vec4(iOffset + position * iScale, 0.0, 1.0);
}
`;

const waveFragment = `
precision highp float;

varying vec2 vUv;
varying float vOpacity;

uniform float uRings;

const float PI = 3.141592653589793;
const float EDGE = 0.006737947;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;

  float brush = (exp(-r * 5.0) - EDGE) / (1.0 - EDGE);

  brush *= 0.55 + 0.45 * cos(sqrt(r) * PI * 2.0 * uRings);

  gl_FragColor = vec4(vec3(brush * vOpacity * vOpacity), 1.0);
}
`;

const screenVertex = `
precision highp float;
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/* sem imagem: a água vira só cor, com transparência, usando o mesmo campo de ondas */
const compositeFragment = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uDisplacement;
uniform vec2 uTexel;
uniform vec3 uTint;
uniform float uAlpha;

void main() {
  float amount = texture2D(uDisplacement, vUv).r;
  float ex = texture2D(uDisplacement, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDisplacement, vUv - vec2(uTexel.x, 0.0)).r;
  float ey = texture2D(uDisplacement, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDisplacement, vUv - vec2(0.0, uTexel.y)).r;
  float edge = length(vec2(ex, ey)) * 4.0;

  float a = clamp(amount * 0.22 + edge, 0.0, 1.0) * uAlpha;
  gl_FragColor = vec4(uTint * a, a);
}
`;

const hexToRGB = (hex) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

async function start() {
  if (!mount) return;
  await window.Loja?.pronto;   // o tom inicial vem do primeiro slide, que só existe depois da carga
  const { Renderer, Program, Mesh, Geometry, Triangle, RenderTarget } =
    await import('/vendor/ogl.js');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, dpr: Math.min(devicePixelRatio || 1, 2) });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  mount.appendChild(canvas);

  const offsets = new Float32Array(MAX_WAVES * 2);
  const scales = new Float32Array(MAX_WAVES * 2);
  const opacities = new Float32Array(MAX_WAVES);
  const waves = Array.from({ length: MAX_WAVES }, () => ({ x: 0, y: 0, scale: START_SCALE, target: START_SCALE, size: 1, opacity: 0 }));
  let current = 0;

  const geometry = new Geometry(gl, {
    position: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]) },
    uv: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]) },
    iOffset: { instanced: 1, size: 2, data: offsets },
    iScale: { instanced: 1, size: 2, data: scales },
    iOpacity: { instanced: 1, size: 1, data: opacities }
  });

  const waveProgram = new Program(gl, {
    vertex: waveVertex, fragment: waveFragment, uniforms: { uRings: { value: P.rings } },
    transparent: true, depthTest: false, depthWrite: false, cullFace: false
  });
  waveProgram.setBlendFunc(gl.ONE, gl.ONE);
  const waveMesh = new Mesh(gl, { geometry, program: waveProgram, frustumCulled: false });

  const displacementTarget = new RenderTarget(gl, {
    width: 2, height: 2, depth: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE
  });

  const startTint = hexToRGB(document.querySelector('.slide.active')?.dataset.tint || '#12b886');
  let targetTint = startTint.slice();

  const uniforms = {
    uDisplacement: { value: displacementTarget.texture },
    uTexel: { value: [1, 1] },
    uTint: { value: startTint.slice() },
    uAlpha: { value: P.alpha }
  };
  const compositeMesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, { vertex: screenVertex, fragment: compositeFragment, uniforms, depthTest: false, depthWrite: false })
  });

  let width = 1, height = 1;
  const resize = () => {
    width = Math.max(1, mount.clientWidth);
    height = Math.max(1, mount.clientHeight);
    renderer.setSize(width, height);
    const scale = QUALITY_SCALE[P.quality] || 1;
    const fieldW = Math.max(2, Math.round(width * scale));
    const fieldH = Math.max(2, Math.round(height * scale));
    displacementTarget.setSize(fieldW, fieldH);
    uniforms.uTexel.value = [1 / fieldW, 1 / fieldH];
  };
  new ResizeObserver(resize).observe(mount);
  resize();

  document.addEventListener('offer-change', (e) => { targetTint = hexToRGB(e.detail.tint); });

  const setNewWave = (x, y) => {
    const wave = waves[current];
    current = (current + 1) % MAX_WAVES;
    wave.x = x;
    wave.y = y;
    wave.scale = START_SCALE;
    wave.target = START_SCALE * Math.max(1, P.spread);
    wave.size = Math.max(1, P.brushSize);
    wave.opacity = 1;
  };

  /* ponteiro virtual: pausa, e então dispara de repente para o outro lado */
  const anchorY = () => {
    const tile = document.querySelector('.slide.active .tile') || document.querySelector('.tile');
    if (!tile) return height * 0.4;
    const mr = mount.getBoundingClientRect();
    const tr = tile.getBoundingClientRect();
    return tr.top - mr.top + tr.height / 2;
  };

  /* vai para a direita e para a esquerda, saindo da tela e voltando: a amplitude
     passa das bordas, então a virada acontece fora da vista, sem trancos visíveis */
  let clock = 0;
  const pointerAt = (t) => {
    const x = width * (0.5 + 0.78 * Math.sin(t * 0.9));
    const y = anchorY() + 28 * Math.sin(t * 1.7);
    return [x, y];
  };

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(mount);

  let previousX = -1e4, previousY = -1e4, previousTime = 0;

  const loop = (now) => {
    requestAnimationFrame(loop);
    const delta = previousTime ? Math.min(0.05, (now - previousTime) / 1000) : 0;
    previousTime = now;
    if (!visible) return;

    if (!reduceMotion) {
      clock += delta;
      const [px, py] = pointerAt(clock);
      const x = px, y = height - py;                      // y invertido (GL)
      const step = Math.max(1, P.spacing);
      if (previousX < -1e3) { previousX = x; previousY = y; }
      const dist = Math.hypot(x - previousX, y - previousY);
      if (dist >= step) {
        // preenche o caminho entre dois quadros, sem deixar buracos na trilha
        const n = Math.floor(dist / step);
        for (let k = 1; k <= n; k += 1) {
          setNewWave(previousX + ((x - previousX) * k) / n, previousY + ((y - previousY) * k) / n);
        }
        previousX = x;
        previousY = y;
      }
    }

    const ease = 1 - Math.exp(-delta * 2.2);
    for (let k = 0; k < 3; k += 1) {
      uniforms.uTint.value[k] += (targetTint[k] - uniforms.uTint.value[k]) * ease;
    }

    const growth = reduceMotion ? 0 : 1 - Math.exp(-delta * 1.09);
    const decay = reduceMotion ? 1 : Math.exp((-delta * LIFE_CONSTANT) / Math.max(0.15, P.fade));

    for (let i = 0; i < MAX_WAVES; i += 1) {
      const wave = waves[i];
      if (wave.opacity <= 0) { opacities[i] = 0; continue; }

      wave.opacity *= decay;
      wave.scale += (wave.target - wave.scale) * growth;

      if (wave.opacity < 0.002) { wave.opacity = 0; opacities[i] = 0; continue; }

      const half = (wave.scale * wave.size) / 2;
      offsets[i * 2] = (wave.x / width) * 2 - 1;
      offsets[i * 2 + 1] = (wave.y / height) * 2 - 1;
      scales[i * 2] = (half / width) * 2;
      scales[i * 2 + 1] = (half / height) * 2;
      opacities[i] = wave.opacity;
    }

    geometry.attributes.iOffset.needsUpdate = true;
    geometry.attributes.iScale.needsUpdate = true;
    geometry.attributes.iOpacity.needsUpdate = true;

    renderer.render({ scene: waveMesh, target: displacementTarget, clear: true });
    renderer.render({ scene: compositeMesh });
  };
  requestAnimationFrame(loop);
}

start().catch((err) => console.warn('Efeito de ondas indisponível:', err));
