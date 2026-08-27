/**
 * One Hand — scena "tarocco" per il canvas di tracking.
 * Nessuna camera: solo fondo nero stellato con sole e luna incisi in oro,
 * la mano tracciata e particelle a forma di stella emesse dalle dita.
 */

export type StarParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  rot: number;
  spin: number;
};

const GOLD = "217,180,95";
const CREAM = "255,246,220";

let stars: { x: number; y: number; r: number; p: number }[] = [];
let starsKey = "";

function ensureStars(w: number, h: number) {
  const key = `${w}x${h}`;
  if (key === starsKey && stars.length) return;
  starsKey = key;
  stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.3 + 0.4,
    p: Math.random() * Math.PI * 2,
  }));
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 4) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.34;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawRays(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  count: number,
  len: number,
  phase: number,
) {
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + phase;
    const l = len * (i % 2 === 0 ? 1 : 0.6);
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * (r + l), y + Math.sin(a) * (r + l));
  }
  ctx.stroke();
}

/** fondo: cielo nero, stelle, sole a sinistra e luna a destra, cornice dorata */
export function drawTarotBack(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ensureStars(w, h);

  const bg = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  bg.addColorStop(0, "#12111a");
  bg.addColorStop(1, "#05050a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // stelle
  for (const s of stars) {
    const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.p));
    ctx.globalAlpha = tw * 0.8;
    ctx.fillStyle = `rgb(${CREAM})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const u = Math.min(w, h);

  // ————— sole (sinistra) —————
  const sx = w * 0.24;
  const sy = h * 0.34;
  const sr = u * 0.085;
  ctx.save();
  ctx.strokeStyle = `rgba(${GOLD},0.75)`;
  ctx.lineWidth = Math.max(1, u * 0.004);
  drawRays(ctx, sx, sy, sr * 1.25, 20, sr * 0.6, t * 0.15);
  const sg = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr);
  sg.addColorStop(0, `rgba(255,236,178,0.95)`);
  sg.addColorStop(1, `rgba(${GOLD},0.55)`);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,24,10,0.75)";
  ctx.lineWidth = Math.max(1, u * 0.003);
  // volto stilizzato
  ctx.beginPath();
  ctx.arc(sx - sr * 0.32, sy - sr * 0.12, sr * 0.09, 0, Math.PI * 2);
  ctx.arc(sx + sr * 0.32, sy - sr * 0.12, sr * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy + sr * 0.12, sr * 0.4, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  ctx.restore();

  // ————— luna (destra) —————
  const mx = w * 0.76;
  const my = h * 0.66;
  const mr = u * 0.075;
  ctx.save();
  ctx.strokeStyle = `rgba(${GOLD},0.45)`;
  ctx.lineWidth = Math.max(1, u * 0.0025);
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(mx, my, mr * (1.4 + i * 0.32), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(${GOLD},0.9)`;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(mx + mr * 0.52, my - mr * 0.18, mr * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  // ————— cornice a doppia linea —————
  ctx.save();
  ctx.strokeStyle = `rgba(${GOLD},0.55)`;
  ctx.lineWidth = Math.max(1, u * 0.004);
  const p1 = u * 0.03;
  ctx.strokeRect(p1, p1, w - p1 * 2, h - p1 * 2);
  ctx.globalAlpha = 0.5;
  const p2 = u * 0.045;
  ctx.lineWidth = Math.max(1, u * 0.002);
  ctx.strokeRect(p2, p2, w - p2 * 2, h - p2 * 2);
  ctx.restore();
}

/** spawn di stelline dalle punte delle dita */
export function spawnStars(
  list: StarParticle[],
  points: { x: number; y: number }[],
  amount: number,
  max = 160,
) {
  for (const p of points) {
    const n = Math.round(1 + amount * 2);
    for (let i = 0; i < n; i++) {
      if (list.length >= max) return;
      const a = Math.random() * Math.PI * 2;
      const sp = 12 + Math.random() * 55 * (0.5 + amount);
      const life = 0.35 + Math.random() * 0.45;
      list.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 12,
        life,
        max: life,
        r: 2 + Math.random() * 3.4,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 6,
      });
    }
  }
}

export function drawStars(ctx: CanvasRenderingContext2D, list: StarParticle[], dt: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 26 * dt;
    p.vx *= 0.985;
    p.rot += p.spin * dt;
    const k = p.life / p.max;
    ctx.globalAlpha = Math.min(1, k * 1.2);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.shadowBlur = 12;
    ctx.shadowColor = `rgba(${GOLD},0.9)`;
    ctx.fillStyle = `rgba(${CREAM},0.95)`;
    starPath(ctx, 0, 0, p.r * (0.5 + k * 0.8));
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();
}
