'use strict';
// ============================================================
// Presentation Generator + Реферат
// Один "движок раскладки" для всего: превью, PPTX и PDF
// строятся из одних и тех же сцен, поэтому выглядят одинаково.
// ============================================================

// ============================================================
// ============ STORAGE =======================================
// ============================================================
const safeStorage = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

let currentPresentation = null;
let currentReferat = null;

// ============================================================
// ============ ТЕМА САЙТА ====================================
// ============================================================
function initTheme() {
  const saved = safeStorage.get('siteTheme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  safeStorage.set('siteTheme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const el = document.getElementById('themeIcon');
  if (el) el.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ============================================================
// ============ UI ============================================
// ============================================================
function openModal() { document.getElementById('modal').classList.add('active'); }
function closeModal() { document.getElementById('modal').classList.remove('active'); }
function openReavizModal() { document.getElementById('reavizModal').classList.add('active'); }
function closeReavizModal() { document.getElementById('reavizModal').classList.remove('active'); }
function openPreview() { document.getElementById('previewModal').classList.add('active'); }
function closePreview() { document.getElementById('previewModal').classList.remove('active'); }
function openRefModal() { document.getElementById('refModal').classList.add('active'); }
function closeRefModal() { document.getElementById('refModal').classList.remove('active'); }
function openRefPreview() { document.getElementById('refPreviewModal').classList.add('active'); }
function closeRefPreview() { document.getElementById('refPreviewModal').classList.remove('active'); }

let _statusTimer = null;
function showStatus(text, ms) {
  const s = document.getElementById('status');
  s.textContent = text;
  s.classList.add('active');
  clearTimeout(_statusTimer);
  _statusTimer = setTimeout(() => s.classList.remove('active'), ms || 6000);
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// ============ ФАЙЛЫ И КАРТИНКИ ==============================
// ============================================================
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('Ошибка чтения файла'));
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось открыть картинку'));
    img.src = src;
  });
}

async function downscaleRaw(dataUrl) {
  const img = await loadImage(dataUrl);
  const k = Math.min(1, 1920 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k));
  c.height = Math.max(1, Math.round(img.height * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

async function normalizeBackground(dataUrl, fit) {
  const img = await loadImage(dataUrl);
  const W = 1920, H = 1080;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  fit = fit || 'stretch';
  if (fit === 'cover') {
    const k = Math.max(W / img.width, H / img.height);
    const w = img.width * k, h = img.height * k;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  } else if (fit === 'blur') {
    const tiny = document.createElement('canvas');
    tiny.width = 64; tiny.height = 36;
    const tc = tiny.getContext('2d');
    const kb = Math.max(64 / img.width, 36 / img.height);
    tc.drawImage(img, (64 - img.width * kb) / 2, (36 - img.height * kb) / 2, img.width * kb, img.height * kb);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tiny, 0, 0, W, H);
    const k = Math.min(W / img.width, H / img.height);
    const w = img.width * k, h = img.height * k;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  } else {
    ctx.drawImage(img, 0, 0, W, H);
  }
  return c.toDataURL('image/jpeg', 0.9);
}

function makeGradientBg(theme) {
  const W = 1920, H = 1080;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#' + theme.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + parseInt(color.slice(0, 2), 16) + ',' + parseInt(color.slice(2, 4), 16) + ',' + parseInt(color.slice(4, 6), 16) + ',' + a + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W * 0.12, H * 0.1, 900, theme.accent, 0.28);
  glow(W * 0.92, H * 0.95, 1000, theme.accent2, 0.22);
  glow(W * 0.7, H * 0.15, 500, theme.accent2, 0.08);
  return c.toDataURL('image/jpeg', 0.92);
}

const IMG_CACHE = new Map();
function cacheImage(src) {
  if (!src) return Promise.resolve(null);
  if (IMG_CACHE.has(src)) return Promise.resolve(IMG_CACHE.get(src));
  return loadImage(src).then(el => { IMG_CACHE.set(src, el); return el; }).catch(() => null);
}

// ===== Фото по теме слайда (Wikimedia Commons) =====
async function searchPhotos(query) {
  if (!query) return [];
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=' + encodeURIComponent(query + ' filetype:bitmap') +
    '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1000';
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const pages = j.query && j.query.pages ? Object.values(j.query.pages).sort((a, b) => a.index - b.index) : [];
  return pages.map(pg => pg.imageinfo && pg.imageinfo[0])
    .filter(ii => ii && /jpeg|png/.test(ii.mime || '') && ii.width >= 500 && ii.height >= 350 && ii.thumburl)
    .map(ii => ii.thumburl);
}

async function shrinkPhoto(dataUrl, maxSide) {
  const img = await loadImage(dataUrl);
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k));
  c.height = Math.max(1, Math.round(img.height * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
}

async function fetchPhoto(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const blob = await resp.blob();
  const raw = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return shrinkPhoto(raw, 1000);
}

function photoQuery(heading) {
  return String(heading || '').replace(/\(продолжение\)/g, '').replace(/^[\d.\s]+/, '').trim();
}

function setSlidePhoto(slide, ph, credit) {
  slide.image = ph.data; slide.imgW = ph.w; slide.imgH = ph.h;
  slide.credit = credit === undefined ? 'Wikimedia Commons' : credit;
  cacheImage(ph.data);
}

async function attachPhotos(p, mode, onProgress) {
  if (!mode || mode === 'none') return 0;
  const targets = p.slides
    .filter(sl => !sl.svc && !sl.kind && sl.heading && !sl.image && (mode === 'all' || visualWeight(sl.body) <= 450))
    .slice(0, 14);
  const used = new Set();
  let done = 0, count = 0;
  for (let i = 0; i < targets.length; i += 3) {
    await Promise.all(targets.slice(i, i + 3).map(async sl => {
      try {
        const urls = (await searchPhotos(photoQuery(sl.heading))).filter(u => !used.has(u));
        sl._cands = urls.slice();
        for (const u of urls) {
          used.add(u);
          sl._cands = sl._cands.filter(x => x !== u);
          try { setSlidePhoto(sl, await fetchPhoto(u)); count++; break; } catch (e) {}
        }
      } catch (e) { console.warn('Фото недоступно:', e.message); }
      done++;
      if (onProgress) onProgress(done, targets.length);
    }));
  }
  return count;
}

async function fetchAutoPhoto(query, fit) {
  if (!query) return null;
  try {
    const url = `https://loremflickr.com/1600/900/${encodeURIComponent(query)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return await normalizeBackground(dataUrl, fit);
  } catch (e) {
    console.warn('Автоподбор фото недоступен:', e.message);
    return null;
  }
}

// ============================================================
// ============ ТЕМЫ ==========================================
// ============================================================
const THEMES = [
  { name: 'midnight', bg: '0F0F1E', accent: 'A78BFA', accent2: '22D3EE', text: 'E8E8F0' },
  { name: 'emerald',  bg: '0A1A14', accent: '34D399', accent2: '10B981', text: 'E8F5F0' },
  { name: 'sunset',   bg: '1A0F1E', accent: 'F472B6', accent2: 'FB923C', text: 'F5E8F0' },
  { name: 'ocean',    bg: '0A1520', accent: '38BDF8', accent2: '818CF8', text: 'E8F0F8' },
  { name: 'mono',     bg: '141414', accent: 'E5E5E5', accent2: 'A3A3A3', text: 'F5F5F5' },
  { name: 'crimson',  bg: '1A0A0F', accent: 'F87171', accent2: 'FBBF24', text: 'F5E8E8' }
];
function pickRandomTheme() { return THEMES[Math.floor(Math.random() * THEMES.length)]; }

const REAVIZ_ACCENTS = [
  { name: 'navy',  heading: '1F3A6E', line: '2E5AAC' },
  { name: 'bordo', heading: '6B1F2E', line: '8B2F3E' },
  { name: 'green', heading: '1A4D2E', line: '2E7D4E' },
  { name: 'graph', heading: '2A2A2A', line: '4A4A4A' }
];
function pickReavizAccent() { return REAVIZ_ACCENTS[Math.floor(Math.random() * REAVIZ_ACCENTS.length)]; }
function jitter(value, range) { return value + (Math.random() * 2 - 1) * range; }

// ============================================================
// ============ ИЗМЕРЕНИЕ ТЕКСТА ==============================
// ============================================================
const SLIDE_W = 10, SLIDE_H = 5.625, PT = 72;
const MARGIN = 5;
const LINE = 1.2;
const BULLET_INDENT = 20;
const WRAP_SAFETY = 0.97;
const HEIGHT_SAFETY = 0.95;
const GAP_BIG_K = 0.6;
const GAP_SMALL_K = 0.25;
const MIN_COMFY = 14;
const BODY_MAX = 24;
const BODY_MIN_EMERGENCY = 10;

const FONT_STACK = {
  'Times New Roman': '"Times New Roman", Times, "Liberation Serif", serif',
  'Arial': 'Arial, Helvetica, "Liberation Sans", sans-serif',
  'Calibri': 'Calibri, Carlito, "Segoe UI", Arial, sans-serif',
  'Georgia': 'Georgia, "DejaVu Serif", serif'
};
function fontString(size, bold, font) {
  return (bold ? 'bold ' : '') + size + 'px ' + (FONT_STACK[font] || font);
}

let _measureCtx = null;
function measureCtx() {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  return _measureCtx;
}

function wrapLines(str, size, bold, font, maxW) {
  const ctx = measureCtx();
  ctx.font = fontString(size, bold, font);
  const fits = s => ctx.measureText(s).width <= maxW;
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let w of words) {
    while (!fits(w) && w.length > 1) {
      let n = w.length - 1;
      while (n > 1 && !fits(w.slice(0, n))) n--;
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(w.slice(0, n));
      w = w.slice(n);
    }
    const t = cur ? cur + ' ' + w : w;
    if (!cur || fits(t)) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function innerWidthPt(wIn, indent) {
  return (wIn * PT - 2 * MARGIN) * WRAP_SAFETY - (indent || 0);
}

function measureParas(paras, size, wIn, font, mult, extraBig) {
  const lh = size * LINE * mult;
  let h = 0;
  paras.forEach((p, i) => {
    const n = wrapLines(p.text, size, p.bold, font, innerWidthPt(wIn, p.bullet ? BULLET_INDENT : 0)).length;
    h += n * lh;
    if (i < paras.length - 1) h += p.gapBig ? size * GAP_BIG_K + (extraBig || 0) : size * GAP_SMALL_K;
  });
  return h;
}

function fitParas(paras, wIn, hIn, font, opt) {
  const hPt = (hIn * PT - 2 * MARGIN) * HEIGHT_SAFETY;
  let size = null, h = 0;
  for (let s = opt.max; s >= opt.min; s--) {
    const mh = measureParas(paras, s, wIn, font, opt.mult, 0);
    if (mh <= hPt) { size = s; h = mh; break; }
  }
  let over = false;
  if (size === null) {
    size = opt.min;
    h = measureParas(paras, size, wIn, font, opt.mult, 0);
    over = h > hPt;
  }
  let extraBig = 0;
  if (!over && opt.spread !== false) {
    const nBig = paras.filter((p, i) => p.gapBig && i < paras.length - 1).length;
    if (nBig > 0) extraBig = Math.max(0, Math.min((hPt - h) / nBig, size * 1.0));
  }
  return { size, over, extraBig, height: h };
}

function parasWithGaps(paras, fit) {
  return paras.map((p, i) => ({
    text: p.text,
    bold: !!p.bold,
    bullet: !!p.bullet,
    gap: i === paras.length - 1 ? 0 : (p.gapBig ? fit.size * GAP_BIG_K + fit.extraBig : fit.size * GAP_SMALL_K)
  }));
}

// ============================================================
// ============ РАЗБОР ТЕКСТА СЛАЙДА ==========================
// ============================================================
const BULLET_RE = /^([-•*–—▪●])\s+/;
function isBulletLine(l) { return BULLET_RE.test(l); }

function parseBody(body) {
  const blocks = String(body || '').replace(/\r/g, '').split(/\n\s*\n/)
    .map(b => b.split('\n').map(l => l.trim()).filter(Boolean))
    .filter(b => b.length);
  const paras = [];
  blocks.forEach((lines, bi) => {
    lines.forEach((ln, li) => {
      let text = ln, bullet = false, bold = false;
      const bm = ln.match(BULLET_RE);
      if (bm) { bullet = true; text = ln.slice(bm[0].length); }
      const bd = text.match(/^\*\*(.+)\*\*$/);
      if (bd) { bold = true; text = bd[1]; }
      paras.push({ text, bullet, bold, gapBig: li === lines.length - 1 && bi < blocks.length - 1 });
    });
  });
  return paras;
}

// ============================================================
// ============ РАСПРЕДЕЛЕНИЕ ТЕКСТА ПО СЛАЙДАМ ===============
// ============================================================
const LINE_CH = 90;
const UNIT_CAP = 420;
const UNIT_GROUP = 280;

function visualWeight(text) {
  return String(text).split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / LINE_CH)) * LINE_CH, 0) + 40;
}

function normalizeInput(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function cleanHeading(s) {
  return s.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/[_`]/g, '').trim();
}

function isHeadingLine(l) {
  return l.length >= 2 && l.length <= 90 && !isBulletLine(l) && !/[.!?;,:]$/.test(l);
}

function unwrapIfHardWrapped(lines) {
  if (lines.length < 3 || lines.some(isBulletLine)) return lines;
  const noEnd = lines.filter(l => !/[.!?:;]$/.test(l)).length;
  const avg = lines.reduce((a, l) => a + l.length, 0) / lines.length;
  if (noEnd >= lines.length * 0.6 && avg > 35) return [lines.join(' ')];
  return lines;
}

function parseSections(text) {
  const blocks = normalizeInput(text).split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const sections = [];
  let cur = null;
  const start = h => { cur = { heading: h, blocks: [] }; sections.push(cur); };

  blocks.forEach((b, i) => {
    let lines = b.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    if (/^#{1,6}\s+/.test(lines[0])) {
      start(cleanHeading(lines[0]));
      if (lines.length > 1) cur.blocks.push(lines.slice(1));
      return;
    }
    lines = unwrapIfHardWrapped(lines);

    if (lines.length === 1 && isHeadingLine(lines[0]) && i < blocks.length - 1) {
      start(cleanHeading(lines[0]));
      return;
    }
    if (lines.length > 1 && isHeadingLine(lines[0]) && lines[0].length <= 80 &&
        /^([А-ЯЁA-Z0-9]|[-•*–—▪●]\s)/.test(lines[1])) {
      start(cleanHeading(lines[0]));
      cur.blocks.push(lines.slice(1));
      return;
    }
    if (!cur) start('');
    cur.blocks.push(lines);
  });

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (!s.blocks.length && s.heading) {
      const target = sections[i + 1] || sections[i - 1];
      if (target) {
        const line = ['**' + s.heading + '**'];
        if (target === sections[i + 1]) target.blocks.unshift(line); else target.blocks.push(line);
        sections.splice(i, 1);
        i--;
      }
    }
  }
  return sections;
}

function splitSentences(s) {
  return s.split(/(?<=[.!?…])\s+/).filter(Boolean);
}

function blockToUnits(lines, fine) {
  const full = lines.join('\n');
  const cap = fine ? 0 : UNIT_CAP, groupMax = fine ? 0 : UNIT_GROUP;
  if (visualWeight(full) <= cap) return [{ text: full, w: visualWeight(full), sep: '\n\n' }];

  const units = [];
  if (lines.length > 1) {
    let group = [], gw = 0;
    lines.forEach(l => {
      const lw = visualWeight(l) - 40;
      if (group.length && gw + lw > groupMax) {
        const t = group.join('\n');
        units.push({ text: t, w: visualWeight(t), sep: units.length ? '\n' : '\n\n' });
        group = []; gw = 0;
      }
      group.push(l); gw += lw;
    });
    if (group.length) {
      const t = group.join('\n');
      units.push({ text: t, w: visualWeight(t), sep: units.length ? '\n' : '\n\n' });
    }
    return units;
  }

  const sents = splitSentences(lines[0]);
  let group = [], gl = 0;
  sents.forEach(se => {
    if (group.length && gl + se.length > groupMax) {
      const t = group.join(' ');
      units.push({ text: t, w: visualWeight(t), sep: units.length ? ' ' : '\n\n' });
      group = []; gl = 0;
    }
    group.push(se); gl += se.length + 1;
  });
  if (group.length) {
    const t = group.join(' ');
    units.push({ text: t, w: visualWeight(t), sep: units.length ? ' ' : '\n\n' });
  }
  return units;
}

function joinUnits(units) {
  return units.map((u, i) => (i === 0 ? '' : u.sep) + u.text).join('');
}

function partition(w, k) {
  const n = w.length;
  k = Math.max(1, Math.min(k, n));
  if (k === 1) return [[0, n]];
  const pre = [0];
  w.forEach((x, i) => pre.push(pre[i] + x));
  const avg = pre[n] / k;
  const cost = (a, b) => { const s = pre[b] - pre[a]; return (s - avg) * (s - avg); };
  const INF = 1e18;
  const dp = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(INF));
  const cut = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));
  dp[0][0] = 0;
  for (let j = 1; j <= k; j++) {
    for (let i = j; i <= n; i++) {
      for (let m = j - 1; m < i; m++) {
        if (dp[j - 1][m] >= INF) continue;
        const c = dp[j - 1][m] + cost(m, i);
        if (c < dp[j][i]) { dp[j][i] = c; cut[j][i] = m; }
      }
    }
  }
  const res = [];
  let i = n;
  for (let j = k; j >= 1; j--) { const m = cut[j][i]; res.unshift([m, i]); i = m; }
  return res;
}

function continuationHeading(h) {
  if (!h) return '';
  return /\(продолжение\)$/.test(h) ? h : h + ' (продолжение)';
}

function headingFromBody(body) {
  const blocks = body.split(/\n\s*\n/);
  const first = (blocks[0] || '').trim();
  const lines = first.split('\n');
  if (lines.length === 1 && !isBulletLine(first) && !first.startsWith('**')) {
    const m = first.match(/^(.{8,90}?[.!?])(\s+|$)/);
    if (m) {
      const rest = first.slice(m[0].length).trim();
      const nb = [rest].concat(blocks.slice(1)).filter(Boolean).join('\n\n');
      if (nb) return { heading: m[1].replace(/[.!?]+$/, '').trim(), body: nb };
    }
  }
  return { heading: '', body };
}

function distributeText(text, slideTotal) {
  const N = Math.max(1, slideTotal - 1);
  const sections = parseSections(text);
  const buildUnits = fine => sections.forEach(s => {
    s.units = [];
    s.blocks.forEach(b => s.units.push(...blockToUnits(b, fine)));
    s.weight = s.units.reduce((a, u) => a + u.w, 0) + (s.heading ? 60 : 0);
  });
  buildUnits(false);
  const capacity = sections.reduce((a, s) => a + Math.max(1, s.units.length), 0);
  if (capacity < N) buildUnits(true);

  const out = [];

  if (sections.length >= N) {
    const parts = partition(sections.map(s => s.weight), N);
    parts.forEach(([a, b]) => {
      const group = sections.slice(a, b);
      let units = [];
      group.forEach((s, i) => {
        if (i > 0 && s.heading) units.push({ text: '**' + s.heading + '**', w: 60, sep: '\n\n' });
        units = units.concat(s.units);
      });
      out.push({ heading: group[0].heading, body: joinUnits(units), auto: !group[0].heading });
    });
  } else {
    const counts = sections.map(() => 1);
    let left = N - sections.length;
    while (left > 0) {
      let best = -1, bestScore = -1;
      sections.forEach((s, i) => {
        if (counts[i] < s.units.length) {
          const sc = s.weight / counts[i];
          if (sc > bestScore) { bestScore = sc; best = i; }
        }
      });
      if (best < 0) break;
      counts[best]++; left--;
    }
    sections.forEach((s, i) => {
      if (!s.units.length) { out.push({ heading: s.heading, body: '' }); return; }
      const ranges = partition(s.units.map(u => u.w), counts[i]);
      ranges.forEach(([a, b], j) => {
        out.push({
          heading: j === 0 ? s.heading : continuationHeading(s.heading),
          body: joinUnits(s.units.slice(a, b)),
          auto: !s.heading
        });
      });
    });
  }

  return out.map(s => {
    if (s.auto && !s.heading) {
      const r = headingFromBody(s.body);
      return { heading: r.heading, body: r.body };
    }
    return { heading: s.heading, body: s.body };
  });
}

function splitBodyText(body) {
  const tryParts = (parts, sep) => {
    if (parts.length < 2) return null;
    const ws = parts.map(visualWeight);
    const total = ws.reduce((a, b) => a + b, 0);
    let best = 1, bestDiff = Infinity, acc = 0;
    for (let i = 1; i < parts.length; i++) {
      acc += ws[i - 1];
      const d = Math.abs(total - 2 * acc);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    while (best > 1 && /^\*\*[^\n]*\*\*$/.test(parts[best - 1].trim())) best--;
    return [parts.slice(0, best).join(sep), parts.slice(best).join(sep)];
  };
  const blocks = String(body || '').trim().split(/\n\s*\n/).filter(b => b.trim());
  let r = tryParts(blocks, '\n\n');
  if (r) return r;
  const lines = (blocks[0] || '').split('\n').filter(l => l.trim());
  r = tryParts(lines, '\n');
  if (r) return r;
  r = tryParts(splitSentences(blocks[0] || ''), ' ');
  return r;
}

function autoPaginate(p, slides) {
  const out = [];
  const queue = slides.map(s => Object.assign({}, s, { heading: s.heading || '', body: s.body || '' }));
  let guard = 0;
  while (queue.length && guard++ < 1000) {
    const s = queue.shift();
    const r = buildContentScene(p, s, 0);
    if (r.comfy) { out.push(s); continue; }
    const parts = splitBodyText(s.body);
    if (!parts) { out.push(s); continue; }
    const second = { heading: continuationHeading(s.heading), body: parts[1] };
    if (s.svc) second.svc = true;
    queue.unshift(Object.assign({}, s, { body: parts[0] }), second);
  }
  return out;
}

// ============================================================
// ============ СЦЕНЫ =========================================
// ============================================================
function rectItem(x, y, w, h, color, alpha) {
  return { kind: 'rect', x, y, w, h, color, alpha: alpha === undefined ? 1 : alpha };
}

function fitTextItem(box, paras, font, color, o) {
  const fit = fitParas(paras, box.w, box.h, font, { max: o.max, min: o.min, mult: o.mult || 1.15, spread: o.spread });
  return {
    kind: 'text', x: box.x, y: box.y, w: box.w, h: box.h,
    paras: parasWithGaps(paras, fit), size: fit.size, color, font,
    align: o.align || 'left', valign: o.valign || 'top', mult: o.mult || 1.15
  };
}

function P(text, bold) { return { text, bold: !!bold, bullet: false, gapBig: false }; }

function layoutHeading(text, box, font, color, align, maxSize) {
  let t = String(text).replace(/\s+/g, ' ').trim();
  const words = t.split(' ');
  const opt = { max: maxSize || 28, min: 16, mult: 1.0, spread: false };
  let fit = fitParas([P(t, true)], box.w, box.h, font, opt);
  while (fit.over && words.length > 1) {
    words.pop();
    t = words.join(' ') + '…';
    fit = fitParas([P(t, true)], box.w, box.h, font, opt);
  }
  return {
    kind: 'text', x: box.x, y: box.y, w: box.w, h: box.h,
    paras: [{ text: t, bold: true, bullet: false, gap: 0 }],
    size: fit.size, color, font, align: align || 'left', valign: 'middle', mult: 1.0
  };
}

const LOGO_ZONE = 1.8;
function layoutParams(p) {
  if (p.mode === 'reaviz') {
    const side = (p.meta && p.meta.logoSide) || 'right';
    const pad = 0.6;
    let hx, hw;
    if (side === 'right') { hx = pad; hw = SLIDE_W - pad - LOGO_ZONE; }
    else if (side === 'left') { hx = LOGO_ZONE; hw = SLIDE_W - LOGO_ZONE - pad; }
    else { hx = pad; hw = SLIDE_W - 2 * pad; }
    return {
      head: { x: hx, y: 0.25, w: hw, h: 1.1 },
      rule: { x: hx + MARGIN / PT, y: 1.4, w: Math.min(2.2, hw), h: 0.035 },
      body: { x: 0.6, y: 1.6, w: 8.8, h: 3.6 }
    };
  }
  return {
    head: { x: 0.55, y: 0.3, w: 8.3, h: 1.0 },
    rule: { x: 0.55 + MARGIN / PT, y: 1.35, w: 1.8, h: 0.045 },
    body: { x: 0.55, y: 1.55, w: 8.9, h: 3.65 }
  };
}

function styleFont(p) { return (p.style && p.style.font) || (p.mode === 'reaviz' ? 'Times New Roman' : 'Arial'); }
function styleHeadColor(p) { return (p.style && p.style.headColor) || (p.mode === 'reaviz' ? p.theme.heading : p.theme.accent); }
function styleDim(p) { return p.style && typeof p.style.dim === 'number' && !isNaN(p.style.dim) ? p.style.dim : 0.5; }
function styleRule(p) { return !(p.style && p.style.rule === 'none'); }

function sceneBackground(p) {
  if (p.mode === 'reaviz') return { image: p.bgImage || null, color: 'FFFFFF' };
  return { image: p.bgImage || null, color: p.theme.bg };
}

function buildContentScene(p, slide, idx) {
  const G = layoutParams(p);
  const isR = p.mode === 'reaviz';
  const font = styleFont(p);
  const items = [];

  if (!isR) {
    if (p.hasPhoto && styleDim(p) > 0) items.push(rectItem(0, 0, SLIDE_W, SLIDE_H, '000000', styleDim(p)));
    items.push(rectItem(0, 0, 0.12, SLIDE_H, p.theme.accent));
    items.push({
      kind: 'text', x: 9.0, y: 0.2, w: 0.7, h: 0.4,
      paras: [{ text: String(idx + 2), bold: false, bullet: false, gap: 0 }],
      size: 13, color: p.theme.accent2, font, align: 'right', valign: 'middle', mult: 1.0
    });
  }

  const headColor = styleHeadColor(p);
  const lineColor = isR ? p.theme.line : p.theme.accent2;

  if (slide.kind === 'thanks') {
    const th = layoutHeading(slide.heading || 'Спасибо за внимание!', { x: 0.6, y: 1.7, w: 8.8, h: 1.6 }, font, headColor, 'center', 44);
    th.role = 'head';
    items.push(th);
    if (styleRule(p)) { const tr = rectItem((SLIDE_W - 2.2) / 2, 3.4, 2.2, 0.04, lineColor); tr.role = 'rule'; items.push(tr); }
    return { scene: { bg: sceneBackground(p), items }, comfy: true, size: 44 };
  }

  if (slide.heading && slide.heading.trim()) {
    const hd = layoutHeading(slide.heading, G.head, font, headColor);
    hd.role = 'head';
    items.push(hd);
    if (styleRule(p)) { const ru = rectItem(G.rule.x, G.rule.y, G.rule.w, G.rule.h, lineColor); ru.role = 'rule'; items.push(ru); }
  }

  let bodyBox = G.body, picItems = [];
  if (slide.image && slide.imgW && slide.imgH) {
    const picW = 3.4, gap = 0.3;
    const area = { x: G.body.x + G.body.w - picW, y: G.body.y, w: picW, h: G.body.h };
    bodyBox = { x: G.body.x, y: G.body.y, w: G.body.w - picW - gap, h: G.body.h };
    const cred = slide.credit ? 0.25 : 0;
    const maxH = area.h - 0.2 - cred;
    let w = picW, h = w * slide.imgH / slide.imgW;
    if (h > maxH) { h = maxH; w = h * slide.imgW / slide.imgH; }
    const x = area.x + (picW - w) / 2, y = area.y + (area.h - h - cred) / 2;
    const shadow = rectItem(x + 0.07, y + 0.07, w, h, lineColor, 0.35);
    shadow.role = 'picbg';
    picItems.push(shadow, { kind: 'image', x, y, w, h, data: slide.image, role: 'pic' });
    if (slide.credit) {
      picItems.push({
        kind: 'text', x, y: y + h + 0.02, w, h: 0.25,
        paras: [{ text: 'Фото: ' + slide.credit, bold: false, bullet: false, gap: 0 }],
        size: 8, color: isR ? '666666' : 'B0B0B0', font, align: 'right', valign: 'top', mult: 1.0, role: 'credit'
      });
    }
  }

  let comfy = true, size = BODY_MAX;
  const paras = parseBody(slide.body);
  if (paras.length) {
    const textColor = isR ? '000000' : p.theme.text;
    const fit = fitParas(paras, bodyBox.w, bodyBox.h, font, { max: BODY_MAX, min: BODY_MIN_EMERGENCY, mult: 1.15 });
    size = fit.size;
    comfy = !fit.over && fit.size >= MIN_COMFY;
    items.push({
      kind: 'text', x: bodyBox.x, y: bodyBox.y, w: bodyBox.w, h: bodyBox.h,
      paras: parasWithGaps(paras, fit), size: fit.size, color: textColor, font,
      align: 'left', valign: 'middle', mult: 1.15, role: 'body'
    });
  }
  picItems.forEach(it => items.push(it));
  return { scene: { bg: sceneBackground(p), items }, comfy, size };
}

function guessFemale(fio) {
  const t = String(fio || '').toLowerCase().replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  if (!t.length) return false;
  const full = t.join(' ');
  if (/(вна|чна|кызы|гызы)(?=\s|$)/.test(full)) return true;
  if (/(вич|ич|оглы|улы)(?=\s|$)/.test(full)) return false;
  const sur = t[0];
  if (/(ова|ева|ёва|ина|ына|ская|цкая|ая)$/.test(sur)) return true;
  if (/(ов|ев|ёв|ин|ын|ский|цкий|ой|ий)$/.test(sur)) return false;
  if (t[1] && t[1].length > 2 && /[ая]$/.test(t[1]) && !/(илья|никита|данила|кузьма|лука|фома|савва)$/.test(t[1])) return true;
  return false;
}

function buildTitleScene(p) {
  return p.mode === 'reaviz' ? buildReavizTitle(p) : buildFreeTitle(p);
}

function buildReavizTitle(p) {
  const m = p.meta, F = styleFont(p), HC = styleHeadColor(p);
  const side = m.logoSide || 'right';
  const items = [];

  const headBox = side === 'left' ? { x: LOGO_ZONE, y: 0.2, w: SLIDE_W - LOGO_ZONE - 0.4, h: 1.1 }
                : side === 'right' ? { x: 0.4, y: 0.2, w: SLIDE_W - LOGO_ZONE - 0.4, h: 1.1 }
                : { x: 0.5, y: 0.2, w: 9, h: 1.1 };
  items.push(fitTextItem(headBox, [
    P('ЧАСТНОЕ УЧРЕЖДЕНИЕ'),
    P('ОБРАЗОВАТЕЛЬНАЯ ОРГАНИЗАЦИЯ ВЫСШЕГО ОБРАЗОВАНИЯ'),
    P('МЕДИЦИНСКИЙ УНИВЕРСИТЕТ «РЕАВИЗ»')
  ], F, HC, { max: 12, min: 8, align: 'center', valign: 'middle', mult: 1.1 }));

  items.push(fitTextItem({ x: jitter(0.5, 0.02), y: jitter(1.55, 0.02), w: 9, h: 0.4 },
    [P('Кафедра медико-биологических дисциплин', true)], F, '000000',
    { max: 14, min: 10, align: 'center', valign: 'middle', mult: 1.0 }));

  items.push(fitTextItem({ x: jitter(0.6, 0.02), y: jitter(2.0, 0.02), w: 8.8, h: 1.5 }, [
    P('Презентация по дисциплине «' + m.subject + '»'),
    P('на тему'),
    P('«' + m.topic + '»', true)
  ], F, '000000', { max: 18, min: 11, align: 'center', valign: 'middle', mult: 1.1 }));

  const fem = !!m.studentFemale;
  const lines = [P((fem ? 'Выполнила студентка' : 'Выполнил студент') + (m.group ? ' группы ' + m.group : ''))];
  if (m.faculty) lines.push(P(m.faculty));
  lines.push(P(m.fio));
  items.push(fitTextItem({ x: 4.2, y: jitter(3.55, 0.02), w: 5.3, h: 1.0 }, lines, F, '000000',
    { max: 14, min: 10, align: 'right', valign: 'top', mult: 1.1 }));

  items.push(fitTextItem({ x: 4.7, y: jitter(4.55, 0.02), w: 4.8, h: 0.7 },
    [P(m.teacherFemale ? 'Проверила' : 'Проверил'), P(m.teacher)], F, '000000',
    { max: 14, min: 10, align: 'right', valign: 'top', mult: 1.1 }));

  items.push(fitTextItem({ x: 0.5, y: 5.27, w: 9, h: 0.3 }, [P(m.cityYear)], F, '000000',
    { max: 13, min: 10, align: 'center', valign: 'middle', mult: 1.0 }));

  return { bg: sceneBackground(p), items };
}

function buildFreeTitle(p) {
  const m = p.meta, F = styleFont(p);
  const items = [];
  if (p.hasPhoto && styleDim(p) > 0) items.push(rectItem(0, 0, SLIDE_W, SLIDE_H, '000000', styleDim(p)));
  items.push(fitTextItem({ x: 0.5, y: 1.0, w: 9, h: 2.0 }, [P(String(m.subject).toUpperCase(), true)],
    F, 'FFFFFF', { max: 48, min: 22, align: 'center', valign: 'middle', mult: 1.0 }));
  items.push(fitTextItem({ x: 0.5, y: 3.05, w: 9, h: 0.5 }, [P('Презентация по дисциплине')],
    F, 'E0E0E0', { max: 16, min: 12, align: 'center', valign: 'middle', mult: 1.0 }));
  items.push(fitTextItem({ x: 1.0, y: 3.85, w: 8, h: 1.5 }, [
    P('Выполнил: ' + m.fio), P('Группа: ' + m.group), P('Проверил: ' + m.teacher)
  ], F, 'E8E8E8', { max: 16, min: 11, align: 'center', valign: 'top', mult: 1.2 }));
  items.push(rectItem(0, 0, 0.12, SLIDE_H, p.theme.accent));
  return { bg: sceneBackground(p), items };
}

// ============================================================
// ============ РЕНДЕР: CANVAS ================================
// ============================================================
function drawTextItem(ctx, it) {
  const x = it.x * PT, y = it.y * PT, w = it.w * PT, h = it.h * PT;
  const lh = it.size * LINE * it.mult;
  const blocks = it.paras.map(pr => ({
    pr,
    lines: wrapLines(pr.text, it.size, pr.bold, it.font, innerWidthPt(it.w, pr.bullet ? BULLET_INDENT : 0))
  }));
  let total = 0;
  blocks.forEach((b, i) => { total += b.lines.length * lh + (i < blocks.length - 1 ? (b.pr.gap || 0) : 0); });
  let cy = it.valign === 'top' ? y + MARGIN : it.valign === 'bottom' ? y + h - MARGIN - total : y + (h - total) / 2;

  ctx.fillStyle = '#' + it.color;
  ctx.textBaseline = 'middle';
  blocks.forEach((b, bi) => {
    ctx.font = fontString(it.size, b.pr.bold, it.font);
    const ind = b.pr.bullet ? BULLET_INDENT : 0;
    b.lines.forEach((ln, li) => {
      const ty = cy + lh / 2;
      if (b.pr.bullet && li === 0) { ctx.textAlign = 'left'; ctx.fillText('•', x + MARGIN, ty); }
      if (it.align === 'center') { ctx.textAlign = 'center'; ctx.fillText(ln, x + w / 2, ty); }
      else if (it.align === 'right') { ctx.textAlign = 'right'; ctx.fillText(ln, x + w - MARGIN, ty); }
      else { ctx.textAlign = 'left'; ctx.fillText(ln, x + MARGIN + ind, ty); }
      cy += lh;
    });
    if (bi < blocks.length - 1) cy += b.pr.gap || 0;
  });
}

function renderSceneToCanvas(scene, bgEl, canvas, width) {
  const k = width / (SLIDE_W * PT);
  canvas.width = width;
  canvas.height = Math.round(width * SLIDE_H / SLIDE_W);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#' + scene.bg.color;
  ctx.fillRect(0, 0, SLIDE_W * PT, SLIDE_H * PT);
  if (bgEl) ctx.drawImage(bgEl, 0, 0, SLIDE_W * PT, SLIDE_H * PT);
  scene.items.forEach(it => {
    if (it.kind === 'rect') {
      ctx.globalAlpha = it.alpha;
      ctx.fillStyle = '#' + it.color;
      ctx.fillRect(it.x * PT, it.y * PT, it.w * PT, it.h * PT);
      ctx.globalAlpha = 1;
    } else if (it.kind === 'image') {
      const el = IMG_CACHE.get(it.data);
      if (el) ctx.drawImage(el, it.x * PT, it.y * PT, it.w * PT, it.h * PT);
    } else {
      drawTextItem(ctx, it);
    }
  });
}

// ============================================================
// ============ РЕНДЕР: PPTX ==================================
// ============================================================
function renderSceneToPptx(pptx, scene) {
  const s = pptx.addSlide();
  if (scene.bg.image) s.background = { data: scene.bg.image };
  else s.background = { color: scene.bg.color };

  const added = [];
  scene.items.forEach(it => {
    added.push(it);
    if (it.kind === 'image') {
      s.addImage({ data: it.data, x: it.x, y: it.y, w: it.w, h: it.h });
    } else if (it.kind === 'rect') {
      s.addShape(pptx.ShapeType.rect, {
        x: it.x, y: it.y, w: it.w, h: it.h,
        fill: { color: it.color, transparency: Math.round((1 - it.alpha) * 100) },
        line: { type: 'none' }
      });
    } else {
      const runs = it.paras.map((pr, i) => {
        const o = { bold: !!pr.bold, breakLine: i < it.paras.length - 1 };
        if (pr.gap) o.paraSpaceAfter = Math.round(pr.gap);
        if (pr.bullet) o.bullet = { indent: BULLET_INDENT };
        return { text: pr.text, options: o };
      });
      s.addText(runs, {
        x: it.x, y: it.y, w: it.w, h: it.h,
        fontSize: it.size, fontFace: it.font, color: it.color,
        align: it.align, valign: it.valign,
        lineSpacingMultiple: it.mult,
        margin: MARGIN, fit: 'none', isTextBox: true
      });
    }
  });
  return added;
}

function buildPPTX(slides) {
  const p = currentPresentation;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = p.meta.subject || 'Presentation';

  const targets = [];
  targets.push(renderSceneToPptx(pptx, buildTitleScene(p)));
  slides.forEach((s, i) => targets.push(renderSceneToPptx(pptx, buildContentScene(p, s, i).scene)));
  return { pptx, targets };
}

// ============================================================
// ============ ПЕРЕХОДЫ И АНИМАЦИИ ===========================
// ============================================================
const TRANSITIONS = {
  fade: '<p:transition spd="med"><p:fade/></p:transition>',
  push: '<p:transition spd="med"><p:push dir="u"/></p:transition>',
  wipe: '<p:transition spd="med"><p:wipe dir="r"/></p:transition>',
  zoom: '<p:transition spd="med"><p:zoom dir="in"/></p:transition>'
};
const ANIM_DUR = 500;

function effectXml(ctr, spid, kind, nodeType, hasText) {
  const outer = ctr.n++;
  const tgt = '<p:tgtEl><p:spTgt spid="' + spid + '"/></p:tgtEl>';
  const setVis = '<p:set><p:cBhvr><p:cTn id="' + (ctr.n++) + '" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>' + tgt +
    '<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>';
  const filt = f => '<p:animEffect transition="in" filter="' + f + '"><p:cBhvr><p:cTn id="' + (ctr.n++) + '" dur="' + ANIM_DUR + '"/>' + tgt + '</p:cBhvr></p:animEffect>';
  const anim = (attr, from, to) => '<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="' + (ctr.n++) + '" dur="' + ANIM_DUR +
    '" fill="hold"/>' + tgt + '<p:attrNameLst><p:attrName>' + attr + '</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst>' +
    '<p:tav tm="0"><p:val><p:strVal val="' + from + '"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="' + to + '"/></p:val></p:tav></p:tavLst></p:anim>';
  let pid = 10, sub = 0, body;
  if (kind === 'wipe') { pid = 22; sub = 8; body = setVis + filt('wipe(left)'); }
  else if (kind === 'fly') { pid = 2; sub = 4; body = setVis + anim('ppt_x', '#ppt_x', '#ppt_x') + anim('ppt_y', '1+#ppt_h/2', '#ppt_y'); }
  else { body = setVis + filt('fade'); }
  return '<p:par><p:cTn id="' + outer + '" presetID="' + pid + '" presetClass="entr" presetSubtype="' + sub + '" fill="hold"' +
    (hasText ? ' grpId="0"' : '') + ' nodeType="' + nodeType + '"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
    body + '</p:childTnLst></p:cTn></p:par>';
}

function buildTiming(effects, start) {
  const ctr = { n: 3 };
  const steps = [];
  effects.forEach(e => {
    if (!e.withPrev || !steps.length) steps.push([e]); else steps[steps.length - 1].push(e);
  });
  let groups = '';
  if (start === 'click') {
    steps.forEach(grp => {
      const outer = ctr.n++, inner = ctr.n++;
      const eff = grp.map((e, i) => effectXml(ctr, e.spid, e.kind, i === 0 ? 'clickEffect' : 'withEffect', e.text)).join('');
      groups += '<p:par><p:cTn id="' + outer + '" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>' +
        '<p:par><p:cTn id="' + inner + '" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' + eff +
        '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>';
    });
  } else {
    const outer = ctr.n++;
    let inners = '', delay = 0;
    steps.forEach(grp => {
      const inner = ctr.n++;
      const eff = grp.map((e, i) => effectXml(ctr, e.spid, e.kind, i === 0 ? 'afterEffect' : 'withEffect', e.text)).join('');
      inners += '<p:par><p:cTn id="' + inner + '" fill="hold"><p:stCondLst><p:cond delay="' + delay + '"/></p:stCondLst><p:childTnLst>' + eff + '</p:childTnLst></p:cTn></p:par>';
      delay += ANIM_DUR;
    });
    groups = '<p:par><p:cTn id="' + outer + '" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>' +
      '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>' + inners + '</p:childTnLst></p:cTn></p:par>';
  }
  const texts = effects.filter(e => e.text).map(e => '<p:bldP spid="' + e.spid + '" grpId="0"/>').join('');
  return '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
    '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' + groups +
    '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>' +
    '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>' +
    '</p:childTnLst></p:cTn></p:par></p:tnLst>' + (texts ? '<p:bldLst>' + texts + '</p:bldLst>' : '') + '</p:timing>';
}

const SHAPE_ID_RE = /<p:(?:sp|pic)>\s*<p:nv(?:Sp|Pic)Pr>\s*<p:cNvPr id="(\d+)"/g;

function planEffects(items, ids, anim) {
  const dyn = anim === 'dynamic';
  const out = [];
  items.forEach((it, i) => {
    const spid = ids[i];
    if (!it.role || spid === undefined) return;
    const text = it.kind === 'text';
    if (it.role === 'head') out.push({ spid, kind: dyn ? 'wipe' : 'fade', withPrev: false, text });
    else if (it.role === 'rule') out.push({ spid, kind: 'fade', withPrev: true, text });
    else if (it.role === 'body') out.push({ spid, kind: dyn ? 'fly' : 'fade', withPrev: false, text });
    else if (it.role === 'picbg') out.push({ spid, kind: 'fade', withPrev: false, text });
    else if (it.role === 'pic' || it.role === 'credit') out.push({ spid, kind: 'fade', withPrev: true, text });
  });
  return out;
}

async function patchPptx(buf, targets, opts) {
  const zip = await JSZip.loadAsync(buf);
  for (let i = 0; i < targets.length; i++) {
    const path = 'ppt/slides/slide' + (i + 1) + '.xml';
    const f = zip.file(path);
    if (!f) continue;
    let xml = await f.async('string');
    const ids = Array.from(xml.matchAll(SHAPE_ID_RE)).map(m => m[1]);
    let add = '';
    if (opts.trans && opts.trans !== 'none' && TRANSITIONS[opts.trans]) add += TRANSITIONS[opts.trans];
    if (i > 0 && opts.anim && opts.anim !== 'none' && ids.length === targets[i].length) {
      const eff = planEffects(targets[i], ids, opts.anim);
      if (eff.length) add += buildTiming(eff, opts.astart || 'auto');
    }
    if (add) {
      xml = xml.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + add);
      zip.file(path, xml);
    }
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// ============================================================
// ============ СОЗДАНИЕ ПРЕЗЕНТАЦИИ ==========================
// ============================================================
function withServiceSlides(slides, o) {
  const out = [];
  if (o.plan) {
    const hs = [];
    slides.forEach(sl => {
      const h = (sl.heading || '').replace(/\s*\(продолжение\)$/, '').trim();
      if (h && !hs.includes(h)) hs.push(h);
    });
    if (hs.length) out.push({ heading: 'План', svc: true, body: hs.map((h, i) => (i + 1) + '. ' + h).join('\n') });
  }
  slides.forEach(sl => out.push(sl));
  if (o.lit.length) {
    out.push({ heading: 'Список литературы', svc: true, body: o.lit.map((l, i) => (i + 1) + '. ' + l.replace(/^\d+[.)]\s*/, '')).join('\n') });
  }
  if (o.thanks) out.push({ heading: 'Спасибо за внимание!', svc: true, body: '', kind: 'thanks' });
  return out;
}

function readService(prefix) {
  const g = id => document.getElementById(prefix + id);
  const lit = g('lit').value.split('\n').map(l => l.trim()).filter(Boolean);
  const o = { plan: g('plan').checked, thanks: g('thanks').checked, lit };
  o.count = (o.plan ? 1 : 0) + (o.thanks ? 1 : 0) + (lit.length ? 1 : 0);
  return o;
}

function readStyle(prefix) {
  const g = id => document.getElementById(prefix + id);
  const dim = g('dim');
  return {
    font: g('font').value,
    headColor: g('headAuto').checked ? null : g('headColor').value.replace('#', '').toUpperCase(),
    rule: g('rule').value,
    dim: dim ? parseFloat(dim.value) : 0.5,
    bgFit: g('bgFit').value,
    photos: g('photos').value,
    trans: g('trans').value,
    anim: g('anim').value,
    astart: g('astart').value
  };
}

const FORM_FIELDS = {
  rv: ['rv_subject', 'rv_fio', 'rv_group', 'rv_faculty', 'rv_teacher', 'rv_slideCount', 'rv_gender', 'rv_logo',
       'rv_font', 'rv_headColor', 'rv_rule', 'rv_headAuto', 'rv_plan', 'rv_thanks',
       'rv_bgFit', 'rv_photos', 'rv_trans', 'rv_anim', 'rv_astart'],
  fr: ['fio', 'group', 'subject', 'teacher', 'slideCount', 'unsplashQuery',
       'fr_font', 'fr_headColor', 'fr_rule', 'fr_dim', 'fr_headAuto', 'fr_plan', 'fr_thanks',
       'fr_bgFit', 'fr_photos', 'fr_trans', 'fr_anim', 'fr_astart']
};

function saveForm(kind) {
  const data = {};
  FORM_FIELDS[kind].forEach(id => {
    const el = document.getElementById(id);
    if (el) data[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  safeStorage.set('form_' + kind, JSON.stringify(data));
}

function loadForm(kind) {
  const raw = safeStorage.get('form_' + kind);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    FORM_FIELDS[kind].forEach(id => {
      const el = document.getElementById(id);
      if (!el || !(id in data)) return;
      if (el.type === 'checkbox') el.checked = !!data[id]; else el.value = data[id];
    });
  } catch (e) {}
}

function getSavedBg(kind) { return safeStorage.get('bg_' + kind) || null; }

function updateSavedBgHints() {
  [['rv', 'rv_bgSaved'], ['fr', 'fr_bgSaved']].forEach(([kind, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = getSavedBg(kind)
      ? '✅ Сохранённый фон будет использован, если не выбрать новый. <a href="#" onclick="clearSavedBg(\'' + kind + '\'); return false;">Убрать</a>'
      : '';
  });
}

function clearSavedBg(kind) {
  safeStorage.set('bg_' + kind, '');
  updateSavedBgHints();
}

async function resolveBackground(kind, fileInput, fit) {
  let raw;
  if (fileInput.files[0]) {
    raw = await downscaleRaw(await readFileAsDataURL(fileInput.files[0]));
    safeStorage.set('bg_' + kind, raw.length < 3500000 ? raw : '');
  } else {
    raw = getSavedBg(kind);
  }
  return raw ? normalizeBackground(raw, fit) : null;
}

function describeCount(requested, actual) {
  if (actual > requested) return `Текст не помещался в ${requested} слайдов крупным шрифтом — получилось ${actual}.`;
  if (actual < requested) return `Текста хватило только на ${actual} слайдов из ${requested}.`;
  return '';
}

async function addPhotosAndRepaginate(p) {
  const mode = p.style && p.style.photos;
  if (!mode || mode === 'none') return;
  showStatus('⏳ Подбираю фото к слайдам…', 60000);
  const n = await attachPhotos(p, mode, (d, t) => showStatus('⏳ Подбираю фото: ' + d + ' из ' + t, 60000));
  p.slides = autoPaginate(p, p.slides);
  p._photoCount = n;
}

async function buildFreePresentation() {
  const fio = document.getElementById('fio').value.trim() || 'Студент';
  const group = document.getElementById('group').value.trim() || '—';
  const subject = document.getElementById('subject').value.trim() || 'Дисциплина';
  const teacher = document.getElementById('teacher').value.trim() || '—';
  const slideCount = parseInt(document.getElementById('slideCount').value) || 8;
  const text = document.getElementById('content').value.trim();
  const query = document.getElementById('unsplashQuery').value.trim();

  if (!text) { alert('Введите текст презентации'); return null; }

  const style = readStyle('fr_');
  let bgImage = await resolveBackground('fr', document.getElementById('photoAll'), style.bgFit);
  if (!bgImage && query) {
    showStatus('⏳ Загружаю фоновое фото…');
    bgImage = await fetchAutoPhoto(query, style.bgFit);
    if (!bgImage) showStatus('⚠️ Не удалось загрузить фото, делаю без фона');
  }
  const theme = pickRandomTheme();
  const hasPhoto = !!bgImage;
  if (!bgImage) bgImage = makeGradientBg(theme);

  const p = { mode: 'free', theme, bgImage, hasPhoto, style, meta: { fio, group, subject, teacher } };
  const svc = readService('fr_');
  p.slides = autoPaginate(p, withServiceSlides(distributeText(text, slideCount - svc.count), svc));
  await addPhotosAndRepaginate(p);
  saveForm('fr');
  p._requested = slideCount;
  return p;
}

async function buildReavizPresentation() {
  const v = id => document.getElementById(id).value.trim();
  const subject = v('rv_subject'), topic = v('rv_topic'), fio = v('rv_fio');
  const group = v('rv_group'), faculty = v('rv_faculty'), teacher = v('rv_teacher');
  const slideCount = parseInt(v('rv_slideCount')) || 9;
  const text = v('rv_content');
  const bgInput = document.getElementById('rv_bg');

  if (!subject) { alert('Укажи дисциплину'); return null; }
  if (!topic) { alert('Укажи тему'); return null; }
  if (!fio) { alert('Укажи ФИО студента'); return null; }
  if (!teacher) { alert('Укажи, кто проверил'); return null; }
  if (!text) { alert('Вставь текст презентации'); return null; }
  const style = readStyle('rv_');
  const bgImage = await resolveBackground('rv', bgInput, style.bgFit);
  if (!bgImage) { alert('Загрузи фоновую картинку РЕАВИЗ'); return null; }

  const genderSel = document.getElementById('rv_gender').value;
  const studentFemale = genderSel === 'f' ? true : genderSel === 'm' ? false : guessFemale(fio);

  const p = {
    mode: 'reaviz', theme: pickReavizAccent(), bgImage, hasPhoto: true, style,
    meta: {
      subject, topic, fio, group, faculty, teacher, studentFemale,
      teacherFemale: guessFemale(teacher),
      logoSide: document.getElementById('rv_logo').value,
      cityYear: 'Самара - ' + new Date().getFullYear()
    }
  };
  const svc = readService('rv_');
  p.slides = autoPaginate(p, withServiceSlides(distributeText(text, slideCount - svc.count), svc));
  await addPhotosAndRepaginate(p);
  saveForm('rv');
  p._requested = slideCount;
  return p;
}

// ============================================================
// ============ ПРЕВЬЮ ПРЕЗЕНТАЦИИ ============================
// ============================================================
function drawThumb(canvas, scene, bgEl) {
  renderSceneToCanvas(scene, bgEl, canvas, 960);
}

function updateThumb(i) {
  const p = currentPresentation;
  const card = document.querySelector(`.preview-slide[data-i="${i}"]`);
  if (!card) return;
  const r = buildContentScene(p, p.slides[i], i);
  drawThumb(card.querySelector('canvas.thumb'), r.scene, p._bgEl);
  card.querySelector('.slide-warn').style.display = r.comfy ? 'none' : 'block';
  card.querySelector('.slide-size').textContent = r.size + ' pt';
  const rm = card.querySelector('.photo-remove');
  if (rm) rm.style.display = p.slides[i].image ? '' : 'none';
}

function renderPreview() {
  const p = currentPresentation;
  const container = document.getElementById('previewSlides');
  container.innerHTML = '';

  const t = document.createElement('div');
  t.className = 'preview-slide';
  t.innerHTML = `<div class="slide-number">Титул</div><div class="slide-content"><canvas class="thumb"></canvas></div>`;
  container.appendChild(t);
  drawThumb(t.querySelector('canvas'), buildTitleScene(p), p._bgEl);

  p.slides.forEach((slide, i) => {
    const div = document.createElement('div');
    div.className = 'preview-slide';
    div.dataset.i = i;
    div.innerHTML = `
      <div class="slide-number">#${i + 2}<br><span class="slide-size"></span></div>
      <div class="slide-content">
        <canvas class="thumb"></canvas>
        <div class="slide-warn" style="display:none">⚠ Много текста: при сохранении слайд будет автоматически разбит на два</div>
        <input type="text" placeholder="Заголовок" value="${escapeHtml(slide.heading)}" data-idx="${i}" data-field="heading">
        <textarea placeholder="Текст слайда" data-idx="${i}" data-field="body">${escapeHtml(slide.body)}</textarea>
        <div class="slide-actions">
          <button class="mini-btn" onclick="moveSlide(${i}, -1)">↑ Выше</button>
          <button class="mini-btn" onclick="moveSlide(${i}, 1)">↓ Ниже</button>
          <button class="mini-btn" onclick="splitSlide(${i})">✂ Разбить</button>
          ${slide.kind === 'thanks' ? '' : `<button class="mini-btn" onclick="changePhoto(${i})">🖼 Фото по теме</button>
          <button class="mini-btn" onclick="uploadPhoto(${i})">📁 Своё фото</button>
          <button class="mini-btn photo-remove" onclick="removePhoto(${i})" style="${slide.image ? '' : 'display:none'}">✖ Без фото</button>`}
          <button class="mini-btn danger" onclick="deleteSlide(${i})">🗑 Удалить</button>
        </div>
      </div>`;
    container.appendChild(div);
    updateThumb(i);
  });

  const pending = {};
  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.idx);
      p.slides[idx][e.target.dataset.field] = e.target.value;
      cancelAnimationFrame(pending[idx]);
      pending[idx] = requestAnimationFrame(() => updateThumb(idx));
    });
  });
}

async function changePhoto(i) {
  const p = currentPresentation, sl = p.slides[i];
  try {
    showStatus('⏳ Ищу фото…', 30000);
    if (!sl._cands || !sl._cands.length) sl._cands = await searchPhotos(photoQuery(sl.heading) || p.meta.topic || p.meta.subject);
    if (!sl._cands.length) { showStatus('Ничего не нашлось по этому заголовку — загрузи своё фото'); return; }
    const url = sl._cands.shift();
    setSlidePhoto(sl, await fetchPhoto(url));
    await cacheImage(sl.image);
    updateThumb(i);
    showStatus('✅ Фото поставлено. Нажми ещё раз — подберу другое');
  } catch (e) {
    showStatus('⚠️ Не получилось загрузить фото: ' + e.message + ' (нужен интернет)');
  }
}

function uploadPhoto(i) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = async () => {
    if (!inp.files[0]) return;
    try {
      const sl = currentPresentation.slides[i];
      setSlidePhoto(sl, await shrinkPhoto(await readFileAsDataURL(inp.files[0]), 1000), '');
      await cacheImage(sl.image);
      updateThumb(i);
    } catch (e) { alert('Не удалось открыть картинку'); }
  };
  inp.click();
}

function removePhoto(i) {
  const sl = currentPresentation.slides[i];
  sl.image = null; sl.imgW = null; sl.imgH = null; sl.credit = '';
  updateThumb(i);
}

function moveSlide(idx, dir) {
  const n = idx + dir;
  const s = currentPresentation.slides;
  if (n < 0 || n >= s.length) return;
  [s[idx], s[n]] = [s[n], s[idx]];
  renderPreview();
}

function deleteSlide(idx) {
  if (currentPresentation.slides.length <= 1) { alert('Нельзя удалить последний слайд'); return; }
  currentPresentation.slides.splice(idx, 1);
  renderPreview();
}

function splitSlide(idx) {
  const slide = currentPresentation.slides[idx];
  const parts = splitBodyText(slide.body);
  if (!parts) { alert('Слайд слишком короткий, чтобы его разбить'); return; }
  currentPresentation.slides.splice(idx, 1,
    Object.assign({}, slide, { body: parts[0] }),
    { heading: continuationHeading(slide.heading), body: parts[1] });
  renderPreview();
}

// ============================================================
// ============ СКАЧИВАНИЕ ПРЕЗЕНТАЦИИ ========================
// ============================================================
function finalSlides() {
  const p = currentPresentation;
  const before = p.slides.length;
  const slides = autoPaginate(p, p.slides);
  if (slides.length > before) {
    showStatus(`ℹ️ ${slides.length - before} слайд(а) разбито автоматически — текст не помещался`);
  }
  return slides;
}

async function downloadPPTX() {
  try {
    const p = currentPresentation;
    const slides = finalSlides();
    const built = buildPPTX(slides);
    const pptx = built.pptx;
    const st = p.style || {};
    const needPatch = (st.trans && st.trans !== 'none') || (st.anim && st.anim !== 'none');
    const defaultName = p.mode === 'reaviz'
      ? (p.meta.fio ? p.meta.fio + ' ' : '') + 'Презентация ' + p.meta.subject
      : 'presentation';
    const filename = prompt('Введите имя файла:', defaultName) || 'presentation';
    if (needPatch && window.JSZip) {
      const buf = await pptx.write({ outputType: 'arraybuffer' });
      saveBlob(await patchPptx(buf, built.targets, st), filename + '.pptx');
    } else {
      if (needPatch) showStatus('⚠️ Библиотека JSZip не загрузилась — файл сохранён без анимаций');
      await pptx.writeFile({ fileName: filename + '.pptx' });
    }
    saveLast();
    closePreview();
    showStatus('✅ PPTX успешно сохранён!');
  } catch (err) {
    console.error(err);
    alert('Ошибка: ' + err.message);
  }
}

async function downloadPDF() {
  try {
    const p = currentPresentation;
    if (!window.jspdf) throw new Error('Библиотека jsPDF не загрузилась (проверь интернет)');
    showStatus('⏳ Готовлю PDF…');
    const slides = finalSlides();
    await Promise.all(slides.map(sl => cacheImage(sl.image)));
    const filename = prompt('Имя PDF-файла:', 'presentation') || 'presentation';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [SLIDE_W * PT, SLIDE_H * PT] });
    const canvas = document.createElement('canvas');
    const scenes = [buildTitleScene(p)].concat(slides.map((s, i) => buildContentScene(p, s, i).scene));
    scenes.forEach((sc, i) => {
      renderSceneToCanvas(sc, p._bgEl, canvas, 1920);
      if (i > 0) doc.addPage([SLIDE_W * PT, SLIDE_H * PT], 'landscape');
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, SLIDE_W * PT, SLIDE_H * PT);
    });
    doc.save(filename + '.pdf');
    saveLast();
    showStatus('✅ PDF сохранён!');
  } catch (err) {
    console.error(err);
    alert('Ошибка PDF: ' + err.message);
  }
}

// ============================================================
// ============ ПОСЛЕДНЯЯ ПРЕЗЕНТАЦИЯ =========================
// ============================================================
function saveLast() {
  const p = currentPresentation;
  safeStorage.set('lastPresentation', JSON.stringify({
    mode: p.mode, meta: p.meta,
    slides: p.slides.map(sl => ({ heading: sl.heading, body: sl.body, kind: sl.kind, svc: sl.svc })),
    hasPhoto: !!p.hasPhoto, theme: p.theme, style: p.style || null,
    slideCount: p.slides.length + 1,
    date: new Date().toLocaleString('ru-RU')
  }));
  safeStorage.set('lastBg', p.bgImage && p.bgImage.length < 3500000 ? p.bgImage : '');
  updateLastPreview();
}

function updateLastPreview() {
  const raw = safeStorage.get('lastPresentation');
  const btn = document.getElementById('lastBtn');
  const preview = document.getElementById('lastPreview');
  if (!raw) {
    preview.textContent = 'Пока нет созданных презентаций';
    btn.disabled = true;
    return;
  }
  try {
    const d = JSON.parse(raw);
    const modeLabel = d.mode === 'reaviz' ? '🎓 РЕАВИЗ' : '✨ Свободная';
    preview.innerHTML = `
      <strong>${modeLabel}</strong><br>
      ${escapeHtml(d.meta.subject || '—')}<br>
      ${escapeHtml(d.meta.fio || '')}${d.meta.group ? ' • ' + escapeHtml(d.meta.group) : ''}<br>
      Слайдов: ${d.slideCount}<br>
      <span style="color:#6a6a85">${escapeHtml(d.date)}</span>`;
    btn.disabled = false;
  } catch (e) {
    preview.textContent = 'Пока нет созданных презентаций';
    btn.disabled = true;
  }
}

async function recreateLast() {
  const raw = safeStorage.get('lastPresentation');
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    const bg = safeStorage.get('lastBg') || null;
    currentPresentation = {
      mode: d.mode, theme: d.theme, style: d.style || null,
      hasPhoto: !!d.hasPhoto, bgImage: bg, meta: d.meta, slides: d.slides
    };
    currentPresentation._bgEl = bg ? await loadImage(bg) : null;
    renderPreview();
    openPreview();
    showStatus(bg ? '✅ Данные и фон восстановлены' : '⚠️ Восстановлен текст, но фон надо загрузить заново');
  } catch (e) { alert('Не удалось восстановить'); }
}

// ============================================================
// ============ ГЛАВНЫЕ ФУНКЦИИ ПРЕЗЕНТАЦИИ ===================
// ============================================================
async function finishGenerate(p, closeFn) {
  updateSavedBgHints();
  p._bgEl = p.bgImage ? await loadImage(p.bgImage) : null;
  await Promise.all(p.slides.map(sl => cacheImage(sl.image)));
  currentPresentation = p;
  closeFn();
  renderPreview();
  openPreview();
  const note = describeCount(p._requested, p.slides.length + 1);
  let photoNote = '';
  if (p.style && p.style.photos && p.style.photos !== 'none') {
    photoNote = p._photoCount ? ' · фото подобрано: ' + p._photoCount : ' · фото найти не удалось (нужен интернет), их можно добавить в предпросмотре';
  }
  showStatus('📝 Проверь слайды и скачай' + (note ? ' · ' + note : '') + photoNote, 10000);
}

async function generateFree() {
  try {
    const p = await buildFreePresentation();
    if (p) await finishGenerate(p, closeModal);
  } catch (err) { console.error(err); alert('Ошибка: ' + err.message); }
}

async function generateReaviz() {
  try {
    const p = await buildReavizPresentation();
    if (p) await finishGenerate(p, closeReavizModal);
  } catch (err) { console.error(err); alert('Ошибка: ' + err.message); }
}

// ============================================================
// ============ РЕФЕРАТ =======================================
// ============================================================
// Парсинг текста реферата в блоки
function parseRefBlocks(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let curList = null;

  const flushList = () => {
    if (curList && curList.length) blocks.push({ type: 'list', items: curList });
    curList = null;
  };

  lines.forEach(raw => {
    const line = raw.trim();
    if (!line) { flushList(); return; }

    // Заголовок: # ...
    const hm = line.match(/^#{1,6}\s+(.+)$/);
    let headingText = null;
    if (hm) headingText = hm[1].trim();
    else if (/^(Введение|Заключение|Содержание|Список литературы|Литература|References)\s*$/i.test(line)) headingText = line;
    else if (/^Глава\s+\d+[.:]?\s+.+$/i.test(line)) headingText = line;

    if (headingText) {
      flushList();
      blocks.push({ type: 'heading', text: headingText });
      return;
    }

    // Пункт списка
    const lm = line.match(/^(\d+[.)]|[-•*])\s+(.+)$/);
    if (lm) {
      if (!curList) curList = [];
      curList.push(lm[2].trim());
      return;
    }

    flushList();
    blocks.push({ type: 'para', text: line });
  });
  flushList();
  return blocks;
}

// Группируем блоки по разделам (по заголовкам)
function groupRefSections(blocks) {
  const sections = [];
  let cur = null;
  blocks.forEach(b => {
    if (b.type === 'heading') {
      cur = { title: b.text, kind: classifySection(b.text), blocks: [] };
      sections.push(cur);
    } else {
      if (!cur) { cur = { title: '', kind: 'body', blocks: [] }; sections.push(cur); }
      cur.blocks.push(b);
    }
  });
  return sections;
}

function classifySection(title) {
  const t = String(title).toLowerCase().trim();
  if (/^введение/.test(t)) return 'intro';
  if (/^заключение/.test(t)) return 'conclusion';
  if (/^(список\s+литературы|литература|references)/.test(t)) return 'references';
  if (/^содержание/.test(t)) return 'toc';
  if (/^глава\s+\d+/.test(t)) return 'chapter';
  return 'section';
}

// Заголовок раздела без "Глава N."
function cleanSecTitle(t) {
  return String(t).replace(/^Глава\s+\d+[.:]?\s*/i, '').trim();
}

// Формируем содержание
function buildRefTOC(sections) {
  const items = [];
  sections.forEach(s => {
    if (s.kind === 'toc') return;
    if (s.kind === 'references') {
      items.push({ title: 'Список литературы', level: 1 });
      return;
    }
    if (s.kind === 'chapter') {
      items.push({ title: s.title, level: 1 });
      return;
    }
    // введение / заключение — как есть
    items.push({ title: s.title, level: 1 });
  });
  return items;
}

function buildReferatData() {
  const v = id => (document.getElementById(id).value || '').trim();
  const genderSel = v('rf_gender');
  const fio = v('rf_fio');
  const data = {
    subject: v('rf_subject') || 'страноведению',
    topic: v('rf_topic'),
    fio,
    course: v('rf_course') || '1',
    group: v('rf_group'),
    faculty: v('rf_faculty'),
    kafedra: v('rf_kafedra').toUpperCase() || 'ГУМАНИТАРНЫХ ДИСЦИПЛИН',
    city: (v('rf_city') || 'САМАРА').toUpperCase(),
    teacher: v('rf_teacher'),
    teacherPost: v('rf_teacherPost'),
    year: String(new Date().getFullYear()),
    font: v('rf_font') || 'Times New Roman',
    fontSize: parseInt(v('rf_fontSize')) || 14,
    lineHeight: parseFloat(v('rf_lineHeight')) || 1.5,
    indent: parseInt(v('rf_indent')) || 0,
    studentFemale: genderSel === 'f' ? true : genderSel === 'm' ? false : guessFemale(fio)
  };
  return data;
}

function buildReferat() {
  const meta = buildReferatData();
  if (!meta.topic) { alert('Укажи тему реферата'); return null; }
  if (!meta.fio) { alert('Укажи ФИО студента'); return null; }
  if (!meta.teacher) { alert('Укажи, кто проверил'); return null; }
  const text = (document.getElementById('rf_content').value || '').trim();
  if (!text) { alert('Вставь текст реферата'); return null; }

  const blocks = parseRefBlocks(text);
  const sections = groupRefSections(blocks);
  const toc = buildRefTOC(sections);
  return { meta, sections, toc };
}

// ---------- Превью реферата ----------
function renderReferatPreview() {
  const r = currentReferat;
  const box = document.getElementById('refPages');
  box.innerHTML = '';
  const m = r.meta;

  // 1) Титульный лист
  const tp = document.createElement('div');
  tp.className = 'ref-page title';
  tp.innerHTML = `
    <div class="page-tag">Стр. 1 · Титульный лист</div>
    <div class="t-top">
      ЧАСТНОЕ УЧРЕЖДЕНИЕ<br>
      ОБРАЗОВАТЕЛЬНАЯ ОРГАНИЗАЦИЯ<br>
      ВЫСШЕГО ПРОФЕССИОНАЛЬНОГО ОБРАЗОВАНИЯ<br>
      МЕДИЦИНСКИЙ УНИВЕРСИТЕТ «РЕАВИЗ»
    </div>
    <div class="t-kaf">КАФЕДРА ${escapeHtml(m.kafedra)}</div>
    <div class="t-type">реферат</div>
    <div class="t-subj">по ${escapeHtml(m.subject)}</div>
    <div class="t-on">на тему:</div>
    <div class="t-topic">«${escapeHtml(m.topic)}»</div>
    <div class="t-right">
      ${m.studentFemale ? 'Выполнила: студентка' : 'Выполнил: студент'}${m.course ? ' ' + escapeHtml(m.course) + ' курса' : ''}${m.group ? ' группы ' + escapeHtml(m.group) : ''}<br>
      ${m.faculty ? 'Факультета «' + escapeHtml(m.faculty) + '»<br>' : ''}
      ${escapeHtml(m.fio)}<br><br>
      Проверил: ${m.teacherPost ? escapeHtml(m.teacherPost) + ' ' : ''}${escapeHtml(m.teacher)}
    </div>
    <div class="t-city">${escapeHtml(m.city)}, ${escapeHtml(m.year)}</div>
  `;
  box.appendChild(tp);

  // 2) Содержание
  const cp = document.createElement('div');
  cp.className = 'ref-page toc';
  let tocHtml = '<h3>СОДЕРЖАНИЕ</h3>';
  let pageN = 3;
  r.toc.forEach(it => {
    tocHtml += `<div class="toc-row lvl${it.level}">
      <span class="toc-title">${escapeHtml(it.title)}</span>
      <span class="toc-dots"></span>
      <span class="toc-page">${pageN}</span>
    </div>`;
    pageN++;
  });
  cp.innerHTML = `<div class="page-tag">Стр. 2 · Содержание</div>` + tocHtml;
  box.appendChild(cp);

  // 3) Разделы
  let sectionPage = 3;
  r.sections.forEach((s, si) => {
    const sp = document.createElement('div');
    sp.className = 'ref-page';
    let inner = `<div class="page-tag">Стр. ${sectionPage} · Раздел</div>`;

    // если раздел не содержит заголовка, покажем как есть
    if (s.title) {
      const isChap = s.kind === 'chapter';
      inner += `<h4 class="sec-title${isChap ? ' chap' : ''}">${escapeHtml(s.title)}</h4>`;
    }

    s.blocks.forEach(b => {
      if (b.type === 'para') {
        inner += `<p>${escapeHtml(b.text)}</p>`;
      } else if (b.type === 'list') {
        inner += '<ol class="ref-list">';
        b.items.forEach(it => inner += `<li>${escapeHtml(it)}</li>`);
        inner += '</ol>';
      }
    });

    sp.innerHTML = inner;
    box.appendChild(sp);
    sectionPage++;
  });

  // 4) Редактор
  const ed = document.createElement('div');
  ed.className = 'ref-editor';
  ed.innerHTML = `
    <p style="margin-bottom:8px;font-weight:600;color:#111;">✏️ Быстрая правка (изменения сразу в тексте реферата)</p>
    <label style="display:block;font-size:12px;color:#444;margin-bottom:4px;">Тема</label>
    <input type="text" id="refEditTopic" value="${escapeHtml(r.meta.topic)}">
    <label style="display:block;font-size:12px;color:#444;margin:8px 0 4px;">ФИО студента</label>
    <input type="text" id="refEditFio" value="${escapeHtml(r.meta.fio)}">
    <label style="display:block;font-size:12px;color:#444;margin:8px 0 4px;">Проверил</label>
    <input type="text" id="refEditTeacher" value="${escapeHtml(r.meta.teacher)}">
    <div class="row-btns">
      <button class="mini-btn" onclick="applyRefEdit()">💾 Применить</button>
    </div>
  `;
  box.appendChild(ed);
}

function applyRefEdit() {
  const t = document.getElementById('refEditTopic').value.trim();
  const f = document.getElementById('refEditFio').value.trim();
  const tc = document.getElementById('refEditTeacher').value.trim();
  if (t) currentReferat.meta.topic = t;
  if (f) { currentReferat.meta.fio = f; currentReferat.meta.studentFemale = guessFemale(f); }
  if (tc) currentReferat.meta.teacher = tc;
  renderReferatPreview();
  showStatus('✅ Изменения применены');
}

async function generateRef() {
  try {
    const r = buildReferat();
    if (!r) return;
    currentReferat = r;
    closeRefModal();
    renderReferatPreview();
    openRefPreview();
    showStatus('📝 Проверь реферат и скачай в DOCX или PDF');
  } catch (err) { console.error(err); alert('Ошибка: ' + err.message); }
}

// ============================================================
// ============ ГЕНЕРАЦИЯ DOCX РЕФЕРАТА =======================
// ============================================================
function downloadRefDOCX() {
  try {
    if (!window.docx) throw new Error('Библиотека docx не загрузилась (проверь интернет)');
    const r = currentReferat;
    const m = r.meta;
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType,
      HeadingLevel, PageBreak, NumberingLevel, LevelFormat
    } = window.docx;

    const FONT = m.font;
    const SIZE_HALF = m.fontSize * 2; // docx использует половинные пункты
    const LINE = Math.round(240 * m.lineHeight); // множитель строки * 240

    const para = (text, opts = {}) => new Paragraph({
      alignment: opts.align || AlignmentType.JUSTIFIED,
      spacing: { line: LINE, after: opts.after || 100 },
      indent: opts.indent !== undefined ? { firstLine: opts.indent } : (m.indent ? { firstLine: m.indent * 20 } : undefined),
      children: [new TextRun({
        text: text, bold: !!opts.bold, size: opts.size || SIZE_HALF, font: FONT,
        italics: !!opts.italics, color: opts.color || '000000'
      })]
    });

    const children = [];

    // ----- Титульный лист -----
    const center = { align: AlignmentType.CENTER };
    children.push(para('ЧАСТНОЕ УЧРЕЖДЕНИЕ', { ...center, bold: true, size: 24, after: 0 }));
    children.push(para('ОБРАЗОВАТЕЛЬНАЯ ОРГАНИЗАЦИЯ', { ...center, bold: true, size: 24, after: 0 }));
    children.push(para('ВЫСШЕГО ПРОФЕССИОНАЛЬНОГО ОБРАЗОВАНИЯ', { ...center, bold: true, size: 24, after: 0 }));
    children.push(para('МЕДИЦИНСКИЙ УНИВЕРСИТЕТ «РЕАВИЗ»', { ...center, bold: true, size: 24, after: 0 }));
    children.push(para('КАФЕДРА ' + m.kafedra, { ...center, bold: true, size: 24, after: 200 }));
    for (let i = 0; i < 4; i++) children.push(para('', center));
    children.push(para('реферат', { ...center, bold: true, size: 32, after: 0 }));
    children.push(para('по ' + m.subject, { ...center, size: SIZE_HALF, after: 0 }));
    children.push(para('на тему:', { ...center, size: SIZE_HALF, after: 0 }));
    children.push(para('«' + m.topic + '»', { ...center, bold: true, size: 32, after: 200 }));
    for (let i = 0; i < 3; i++) children.push(para('', center));
    children.push(para((m.studentFemale ? 'Выполнила: студентка' : 'Выполнил: студент') +
      (m.course ? ' ' + m.course + ' курса' : '') + (m.group ? ' группы ' + m.group : ''),
      { align: AlignmentType.RIGHT, indent: 0, after: 0 }));
    if (m.faculty) children.push(para('Факультета «' + m.faculty + '»', { align: AlignmentType.RIGHT, indent: 0, after: 0 }));
    children.push(para(m.fio, { align: AlignmentType.RIGHT, indent: 0, after: 0 }));
    children.push(para('', center));
    children.push(para('Проверил: ' + (m.teacherPost ? m.teacherPost + ' ' : '') + m.teacher,
      { align: AlignmentType.RIGHT, indent: 0, after: 0 }));
    for (let i = 0; i < 3; i++) children.push(para('', center));
    children.push(para(m.city + ', ' + m.year, { ...center, bold: true, size: SIZE_HALF }));

    // Разрыв страницы
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ----- Содержание -----
    children.push(para('СОДЕРЖАНИЕ', { ...center, bold: true, size: 32, after: 200 }));
    let pageN = 3;
    r.toc.forEach(it => {
      const t = it.title;
      const dotsCount = Math.max(3, 70 - t.length);
      const dots = '.'.repeat(dotsCount);
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { line: LINE, after: 60 },
        tabStops: [{ type: 'right', position: 9000, leader: 'dot' }],
        children: [
          new TextRun({ text: t, font: FONT, size: SIZE_HALF }),
          new TextRun({ text: '\t' + pageN, font: FONT, size: SIZE_HALF })
        ]
      }));
      pageN++;
    });

    // Разрыв страницы
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ----- Разделы -----
    r.sections.forEach((s, si) => {
      // Заголовок
      if (s.title) {
        const isChap = s.kind === 'chapter';
        const isSvc = s.kind === 'intro' || s.kind === 'conclusion' || s.kind === 'references';
        children.push(new Paragraph({
          alignment: isSvc || !isChap ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { line: LINE, before: 200, after: 150 },
          children: [new TextRun({
            text: isChap ? s.title : s.title.toUpperCase(),
            bold: true, font: FONT, size: SIZE_HALF + 2
          })]
        }));
      }

      // Блоки
      s.blocks.forEach(b => {
        if (b.type === 'para') {
          children.push(para(b.text));
        } else if (b.type === 'list') {
          if (s.kind === 'references') {
            b.items.forEach((it, idx) => {
              children.push(new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: LINE, after: 60 },
                indent: { left: 480, hanging: 480 },
                children: [new TextRun({ text: (idx + 1) + '. ' + it, font: FONT, size: SIZE_HALF })]
              }));
            });
          } else {
            b.items.forEach((it, idx) => {
              children.push(new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: LINE, after: 60 },
                indent: { left: 720, hanging: 360 },
                children: [new TextRun({ text: (idx + 1) + '. ' + it, font: FONT, size: SIZE_HALF })]
              }));
            });
          }
        }
      });

      // Пустая строка между разделами
      if (si < r.sections.length - 1) children.push(para('', { after: 0 }));
    });

    const doc = new Document({
      creator: 'Presentation Generator',
      title: m.topic,
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, right: 850, bottom: 1134, left: 1701 } // поля по ГОСТ (2см, 1.5см, 2см, 3см)
          }
        },
        children: children
      }]
    });

    Packer.toBlob(doc).then(blob => {
      const safeName = (m.fio ? m.fio + ' ' : '') + 'Реферат ' + m.topic;
      saveBlob(blob, safeName.replace(/[\\/:*?"<>|]/g, '_') + '.docx');
      showStatus('✅ DOCX сохранён!');
    }).catch(err => { console.error(err); alert('Ошибка DOCX: ' + err.message); });
  } catch (err) {
    console.error(err);
    alert('Ошибка: ' + err.message);
  }
}

// ============================================================
// ============ ГЕНЕРАЦИЯ PDF РЕФЕРАТА ========================
// ============================================================
async function downloadRefPDF() {
  try {
    if (!window.jspdf) throw new Error('Библиотека jsPDF не загрузилась (проверь интернет)');
    const r = currentReferat;
    const m = r.meta;
    const { jsPDF } = window.jspdf;

    // A4: 210×297 мм = 595.28×841.89 pt
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const PW = 595.28, PH = 841.89;
    const ML = 85, MR = 43, MT = 57, MB = 57; // поля (3см, 1.5см, 2см, 2см ≈)
    const W = PW - ML - MR;

    let y = MT;

    const lineH = m.fontSize * 1.4 * m.lineHeight;
    const indent = m.indent || 35;

    const checkPage = (need) => {
      if (y + need > PH - MB) {
        doc.addPage();
        y = MT;
      }
    };

    // ===== Титульник =====
    doc.setFont(m.font, 'bold');
    doc.setFontSize(m.fontSize - 2);
    const center = (t, opts = {}) => {
      const lines = doc.splitTextToSize(t, W);
      lines.forEach(ln => {
        checkPage(lineH);
        doc.text(ln, PW / 2, y, { align: 'center' });
        y += lineH;
      });
      if (opts.after) y += opts.after;
    };
    const right = (t, opts = {}) => {
      const lines = doc.splitTextToSize(t, W);
      lines.forEach(ln => {
        checkPage(lineH);
        doc.text(ln, PW - MR, y, { align: 'right' });
        y += lineH;
      });
      if (opts.after) y += opts.after;
    };

    center('ЧАСТНОЕ УЧРЕЖДЕНИЕ');
    center('ОБРАЗОВАТЕЛЬНАЯ ОРГАНИЗАЦИЯ');
    center('ВЫСШЕГО ПРОФЕССИОНАЛЬНОГО ОБРАЗОВАНИЯ');
    center('МЕДИЦИНСКИЙ УНИВЕРСИТЕТ «РЕАВИЗ»');
    center('КАФЕДРА ' + m.kafedra, { after: 60 });

    y += 80;
    doc.setFontSize(m.fontSize + 4);
    center('реферат', { after: 10 });
    doc.setFontSize(m.fontSize);
    doc.setFont(m.font, 'normal');
    center('по ' + m.subject);
    center('на тему:');
    y += 10;
    doc.setFont(m.font, 'bold');
    doc.setFontSize(m.fontSize + 4);
    center('«' + m.topic + '»', { after: 60 });

    y += 60;
    doc.setFontSize(m.fontSize - 1);
    doc.setFont(m.font, 'normal');
    right((m.studentFemale ? 'Выполнила: студентка' : 'Выполнил: студент') +
      (m.course ? ' ' + m.course + ' курса' : '') + (m.group ? ' группы ' + m.group : ''));
    if (m.faculty) right('Факультета «' + m.faculty + '»');
    right(m.fio);
    y += lineH;
    right('Проверил: ' + (m.teacherPost ? m.teacherPost + ' ' : '') + m.teacher);

    y = PH - MB - 30;
    doc.setFont(m.font, 'bold');
    center(m.city + ', ' + m.year);

    // ===== Содержание =====
    doc.addPage();
    y = MT;
    doc.setFont(m.font, 'bold');
    doc.setFontSize(m.fontSize + 4);
    center('СОДЕРЖАНИЕ', { after: 30 });
    doc.setFontSize(m.fontSize);
    doc.setFont(m.font, 'normal');
    let pageN = 3;
    r.toc.forEach(it => {
      checkPage(lineH);
      doc.text(it.title, ML, y);
      doc.text(String(pageN), PW - MR, y, { align: 'right' });
      // точечная линия
      const titleW = doc.getTextWidth(it.title);
      const numW = doc.getTextWidth(String(pageN));
      const startX = ML + titleW + 4;
      const endX = PW - MR - numW - 4;
      if (endX > startX) {
        const dots = '.'.repeat(Math.floor((endX - startX) / doc.getTextWidth('.')));
        doc.text(dots, startX, y);
      }
      y += lineH;
      pageN++;
    });

    // ===== Разделы =====
    r.sections.forEach(s => {
      doc.addPage();
      y = MT;
      if (s.title) {
        doc.setFont(m.font, 'bold');
        doc.setFontSize(m.fontSize + 2);
        const isChap = s.kind === 'chapter';
        if (isChap) {
          const lines = doc.splitTextToSize(s.title, W);
          lines.forEach(ln => { checkPage(lineH); doc.text(ln, ML, y); y += lineH + 2; });
        } else {
          center(s.title.toUpperCase());
        }
        y += 8;
      }
      doc.setFont(m.font, 'normal');
      doc.setFontSize(m.fontSize);

      s.blocks.forEach(b => {
        if (b.type === 'para') {
          const lines = doc.splitTextToSize(b.text, W);
          lines.forEach((ln, i) => {
            checkPage(lineH);
            const x = i === 0 ? ML + indent : ML;
            doc.text(ln, x, y);
            y += lineH;
          });
          y += 4;
        } else if (b.type === 'list') {
          b.items.forEach((it, idx) => {
            const prefix = (idx + 1) + '. ';
            const lines = doc.splitTextToSize(prefix + it, W - 20);
            lines.forEach((ln, i) => {
              checkPage(lineH);
              const x = i === 0 ? ML + 20 : ML + 30;
              doc.text(ln, x, y);
              y += lineH;
            });
            y += 4;
          });
        }
      });
    });

    const safeName = (m.fio ? m.fio + ' ' : '') + 'Реферат ' + m.topic;
    doc.save(safeName.replace(/[\\/:*?"<>|]/g, '_') + '.pdf');
    showStatus('✅ PDF сохранён!');
  } catch (err) {
    console.error(err);
    alert('Ошибка PDF: ' + err.message);
  }
}

// ============================================================
// ============ СТАРТ =========================================
// ============================================================
initTheme();
loadForm('rv');
loadForm('fr');
updateSavedBgHints();
updateLastPreview();