import * as THREE from 'three';

/** Procedural textures. All are real raster images, so GLTFExporter embeds them in the GLB. */

function makeCanvas(w: number, h: number) {
  if (typeof document === 'undefined') {
    return {
      width: w,
      height: h,
      getContext: () => ({
        fillRect: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: () => {},
      }),
    } as unknown as HTMLCanvasElement;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Deterministic PRNG so exported files are reproducible
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Triple-junction GaAs solar cell grid with silver interconnect bus bars. */
export function solarCellTexture(cols = 8, rows = 8): THREE.CanvasTexture {
  const size = 1024;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const rand = rng(42);
  ctx.fillStyle = '#aeb3b9';
  ctx.fillRect(0, 0, size, size);
  const cw = size / cols;
  const ch = size / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const l = 12 + rand() * 5;
      const hue = 218 + rand() * 8;
      const grad = ctx.createLinearGradient(x * cw, y * ch, (x + 1) * cw, (y + 1) * ch);
      grad.addColorStop(0, `hsl(${hue}, 55%, ${l + 4}%)`);
      grad.addColorStop(1, `hsl(${hue}, 60%, ${l - 2}%)`);
      ctx.fillStyle = grad;
      const m = 3;
      // cells with clipped corners
      const x0 = x * cw + m, y0 = y * ch + m, x1 = (x + 1) * cw - m, y1 = (y + 1) * ch - m;
      const k = 10;
      ctx.beginPath();
      ctx.moveTo(x0 + k, y0);
      ctx.lineTo(x1 - k, y0);
      ctx.lineTo(x1, y0 + k);
      ctx.lineTo(x1, y1 - k);
      ctx.lineTo(x1 - k, y1);
      ctx.lineTo(x0 + k, y1);
      ctx.lineTo(x0, y1 - k);
      ctx.lineTo(x0, y0 + k);
      ctx.closePath();
      ctx.fill();
      // fine grid fingers
      ctx.strokeStyle = 'rgba(170,180,200,0.35)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 14; i++) {
        const fy = y0 + ((y1 - y0) * i) / 14;
        ctx.beginPath();
        ctx.moveTo(x0 + 4, fy);
        ctx.lineTo(x1 - 4, fy);
        ctx.stroke();
      }
      // two bus bars
      ctx.fillStyle = 'rgba(200,206,214,0.9)';
      ctx.fillRect(x0 + (x1 - x0) * 0.33 - 2, y0 + 4, 4, y1 - y0 - 8);
      ctx.fillRect(x0 + (x1 - x0) * 0.66 - 2, y0 + 4, 4, y1 - y0 - 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.name = 'SolarCell_BaseColor';
  return t;
}

/** Crinkled multi-layer-insulation normal map derived from a procedural height field. */
export function mliNormalMap(size = 512): THREE.CanvasTexture {
  const hc = makeCanvas(size, size);
  const hctx = hc.getContext('2d')!;
  const rand = rng(7);
  hctx.fillStyle = 'rgb(128,128,128)';
  hctx.fillRect(0, 0, size, size);
  // random soft facets (foil crinkles)
  for (let i = 0; i < 900; i++) {
    const x = rand() * size, y = rand() * size;
    const r = 6 + rand() * 40;
    const g = hctx.createRadialGradient(x, y, 0, x, y, r);
    const v = Math.floor(rand() * 255);
    g.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    hctx.fillStyle = g;
    hctx.beginPath();
    hctx.ellipse(x, y, r * (0.5 + rand()), r * (0.5 + rand()), rand() * Math.PI, 0, Math.PI * 2);
    hctx.fill();
  }
  // sharp creases
  hctx.lineWidth = 1.5;
  for (let i = 0; i < 220; i++) {
    const x = rand() * size, y = rand() * size;
    const a = rand() * Math.PI * 2;
    const len = 20 + rand() * 90;
    const v = Math.floor(rand() * 255);
    hctx.strokeStyle = `rgba(${v},${v},${v},0.5)`;
    hctx.beginPath();
    hctx.moveTo(x, y);
    hctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    hctx.stroke();
  }
  const h = hctx.getImageData(0, 0, size, size).data;
  const nc = makeCanvas(size, size);
  const nctx = nc.getContext('2d')!;
  const out = nctx.createImageData(size, size);
  const H = (x: number, y: number) => h[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      out.data[i + 3] = 255;
    }
  }
  nctx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(nc);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.name = 'MLI_Crinkle_Normal';
  return t;
}

/** Optical solar reflector radiator tiles (quartz mirrors on white panel). */
export function radiatorTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const rand = rng(99);
  ctx.fillStyle = '#d9dde0';
  ctx.fillRect(0, 0, size, size);
  const n = 12;
  const s = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = 228 + rand() * 20;
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      ctx.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.name = 'Radiator_OSR_BaseColor';
  return t;
}

/** Hex pattern used on composite honeycomb / black kapton areas. */
export function carbonTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#202225';
  ctx.fillRect(0, 0, size, size);
  const w = 8;
  for (let y = 0; y < size; y += w) {
    for (let x = 0; x < size; x += w) {
      const odd = ((x / w + y / w) % 2) === 0;
      ctx.fillStyle = odd ? '#2a2c30' : '#1a1b1e';
      ctx.fillRect(x, y, w, w);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  t.name = 'Carbon_Weave_BaseColor';
  return t;
}
