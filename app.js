'use strict';
// ============================================================
// Presentation Generator
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
  document.getElementById('themeIcon').textContent = theme === 'dark' ? '🌙' : '☀️';
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

// Приводим любой фон к 1920x1080 (режем по "cover"), JPEG.
// Так PPTX не раздувается и фон не растягивается криво.
async function normalizeBackground(dataUrl) {
  const img = await loadImage(dataUrl);
  const W = 1920, H = 1080;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const k = Math.max(W / img.width, H / img.height);
  const w = img.width * k, h = img.height * k;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  return c.toDataURL('image/jpeg', 0.9);
}

// Автоподбор фото. Unsplash Source закрыт, поэтому пробуем loremflickr.
// Запрос лучше писать по-английски. Если не вышло — делаем без фона.
async function fetchAutoPhoto(query) {
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
    return await normalizeBackground(dataUrl);
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
// Все размеры внутри движка: шрифт в pt, координаты слайда в дюймах.
// Слайд 16:9 = 10 x 5.625 дюйма = 720 x 405 pt.
const SLIDE_W = 10, SLIDE_H = 5.625, PT = 72;
const MARGIN = 5;            // внутренний отступ текстового блока, pt
const LINE = 1.2;            // высота строки относительно кегля
const BULLET_INDENT = 20;    // отступ у пунктов списка, pt
const WRAP_SAFETY = 0.97;    // запас по ширине (шрифты в разных программах чуть отличаются)
const HEIGHT_SAFETY = 0.95;  // запас по высоте
const GAP_BIG_K = 0.6;       // отступ между абзацами (в кеглях)
const GAP_SMALL_K = 0.25;    // отступ между пунктами списка
const MIN_COMFY = 14;        // меньше этого кегля тело слайда не делаем — лучше разбить слайд
const BODY_MAX = 24;
const BODY_MIN_EMERGENCY = 10;

const FONT_STACK = {
  'Times New Roman': '"Times New Roman", Times, "Liberation Serif", serif',
  'Arial': 'Arial, Helvetica, "Liberation Sans", sans-serif'
};
function fontString(size, bold, font) {
  return (bold ? 'bold ' : '') + size + 'px ' + (FONT_STACK[font] || font);
}

let _measureCtx = null;
function measureCtx() {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  return _measureCtx;
}

// Перенос по словам. maxW в pt.
function wrapLines(str, size, bold, font, maxW) {
  const ctx = measureCtx();
  ctx.font = fontString(size, bold, font);
  const fits = s => ctx.measureText(s).width <= maxW;
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let w of words) {
    // слишком длинное слово режем по символам
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

// Подбирает самый крупный кегль, при котором текст помещается в блок.
// Остаток места распределяет между абзацами, чтобы текст не "слипался" вверху.
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

// body (строка в окне редактирования) -> абзацы.
// Пустая строка = граница абзацев. Строки внутри блока — пункты.
// Строка вида **текст** выводится жирным.
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
const LINE_CH = 90;      // примерно столько символов в строке слайда
const UNIT_CAP = 420;    // больше этого блок режем на части
const UNIT_GROUP = 280;  // целевой размер части

// "Визуальный вес" текста: сколько места он займёт (короткие строки тоже занимают строку)
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

// Если текст скопирован из PDF с жёсткими переносами строк — склеиваем строки
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

    // 1) явный заголовок: # Заголовок
    if (/^#{1,6}\s+/.test(lines[0])) {
      start(cleanHeading(lines[0]));
      if (lines.length > 1) cur.blocks.push(lines.slice(1));
      return;
    }
    lines = unwrapIfHardWrapped(lines);

    // 2) одинокая короткая строка без точки, а дальше есть текст — заголовок
    if (lines.length === 1 && isHeadingLine(lines[0]) && i < blocks.length - 1) {
      start(cleanHeading(lines[0]));
      return;
    }
    // 3) первая строка короткая, вторая начинается с заглавной / пункта / цифры — заголовок + текст
    if (lines.length > 1 && isHeadingLine(lines[0]) && lines[0].length <= 80 &&
        /^([А-ЯЁA-Z0-9]|[-•*–—▪●]\s)/.test(lines[1])) {
      start(cleanHeading(lines[0]));
      cur.blocks.push(lines.slice(1));
      return;
    }
    if (!cur) start('');
    cur.blocks.push(lines);
  });

  // Заголовок без текста, за которым идёт другой заголовок, превращаем в жирную строку
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

// Блок (массив строк) -> "единицы" текста, которые можно переносить на другой слайд
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

// Делит веса на k подряд идущих групп так, чтобы группы были максимально ровными
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

// Для текста без заголовков: берём первое короткое предложение как заголовок слайда
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

// ГЛАВНАЯ ФУНКЦИЯ: текст -> слайды (без титульного).
// slideTotal — общее число слайдов вместе с титульным.
function distributeText(text, slideTotal) {
  const N = Math.max(1, slideTotal - 1);
  const sections = parseSections(text);
  const buildUnits = fine => sections.forEach(s => {
    s.units = [];
    s.blocks.forEach(b => s.units.push(...blockToUnits(b, fine)));
    s.weight = s.units.reduce((a, u) => a + u.w, 0) + (s.heading ? 60 : 0);
  });
  buildUnits(false);
  // Если кусков меньше, чем нужно слайдов — режем мельче (по предложениям / строкам)
  const capacity = sections.reduce((a, s) => a + Math.max(1, s.units.length), 0);
  if (capacity < N) buildUnits(true);

  const out = [];

  if (sections.length >= N) {
    // Разделов больше (или столько же), чем слайдов: склеиваем соседние разделы
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
    // Раздел получает минимум 1 слайд; лишние слайды отдаём самым "тяжёлым" разделам
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

// Делит тело слайда на две примерно равные части (по абзацам -> строкам -> предложениям)
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
    // жирная строка-подзаголовок не должна оставаться одна в конце слайда
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

// Если слайд не помещается нормальным шрифтом — делим на два (и так, пока не влезет)
function autoPaginate(p, slides) {
  const out = [];
  const queue = slides.map(s => ({ heading: s.heading || '', body: s.body || '' }));
  let guard = 0;
  while (queue.length && guard++ < 1000) {
    const s = queue.shift();
    const r = buildContentScene(p, s, 0);
    if (r.comfy) { out.push(s); continue; }
    const parts = splitBodyText(s.body);
    if (!parts) { out.push(s); continue; }
    queue.unshift(
      { heading: s.heading, body: parts[0] },
      { heading: continuationHeading(s.heading), body: parts[1] }
    );
  }
  return out;
}

// ============================================================
// ============ СЦЕНЫ (общее описание слайда) =================
// ============================================================
// Сцена = { bg: {image, color}, items: [rect | text] }
// rect: {kind:'rect', x,y,w,h, color, alpha}
// text: {kind:'text', x,y,w,h, paras:[{text,bold,bullet,gap}], size, color, font, align, valign, mult}

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

// Заголовок слайда: всегда жирный; кегль подбирается под блок; если не влезает — укорачиваем
function layoutHeading(text, box, font, color) {
  let t = String(text).replace(/\s+/g, ' ').trim();
  const words = t.split(' ');
  const opt = { max: 28, min: 16, mult: 1.0, spread: false };
  let fit = fitParas([P(t, true)], box.w, box.h, font, opt);
  while (fit.over && words.length > 1) {
    words.pop();
    t = words.join(' ') + '…';
    fit = fitParas([P(t, true)], box.w, box.h, font, opt);
  }
  return {
    kind: 'text', x: box.x, y: box.y, w: box.w, h: box.h,
    paras: [{ text: t, bold: true, bullet: false, gap: 0 }],
    size: fit.size, color, font, align: 'left', valign: 'middle', mult: 1.0
  };
}

// Геометрия слайдов.
// У РЕАВИЗ логотип в верхнем углу (logoSide), заголовок стоит В ТОЙ ЖЕ ПОЛОСЕ, но
// с противоположной стороны от логотипа (по умолчанию логотип справа — заголовок левее него).
const LOGO_ZONE = 1.8;   // сколько дюймов от края слайда занимает логотип
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

function sceneBackground(p) {
  if (p.mode === 'reaviz') return { image: p.bgImage || null, color: 'FFFFFF' };
  return { image: p.bgImage || null, color: p.theme.bg };
}

function buildContentScene(p, slide, idx) {
  const G = layoutParams(p);
  const isR = p.mode === 'reaviz';
  const font = isR ? 'Times New Roman' : 'Arial';
  const items = [];

  if (!isR) {
    if (p.bgImage) items.push(rectItem(0, 0, SLIDE_W, SLIDE_H, '000000', 0.5));
    items.push(rectItem(0, 0, 0.12, SLIDE_H, p.theme.accent));
    items.push({
      kind: 'text', x: 9.0, y: 0.2, w: 0.7, h: 0.4,
      paras: [{ text: String(idx + 2), bold: false, bullet: false, gap: 0 }],
      size: 13, color: p.theme.accent2, font, align: 'right', valign: 'middle', mult: 1.0
    });
  }

  const headColor = isR ? p.theme.heading : p.theme.accent;
  const lineColor = isR ? p.theme.line : p.theme.accent2;
  if (slide.heading && slide.heading.trim()) {
    items.push(layoutHeading(slide.heading, G.head, font, headColor));
    items.push(rectItem(G.rule.x, G.rule.y, G.rule.w, G.rule.h, lineColor));
  }

  let comfy = true, size = BODY_MAX;
  const paras = parseBody(slide.body);
  if (paras.length) {
    const textColor = isR ? '000000' : p.theme.text;
    const fit = fitParas(paras, G.body.w, G.body.h, font, { max: BODY_MAX, min: BODY_MIN_EMERGENCY, mult: 1.15 });
    size = fit.size;
    comfy = !fit.over && fit.size >= MIN_COMFY;
    items.push({
      kind: 'text', x: G.body.x, y: G.body.y, w: G.body.w, h: G.body.h,
      paras: parasWithGaps(paras, fit), size: fit.size, color: textColor, font,
      align: 'left', valign: 'middle', mult: 1.15
    });
  }
  return { scene: { bg: sceneBackground(p), items }, comfy, size };
}

// ----- пол по ФИО -----
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
  const m = p.meta, a = p.theme, F = 'Times New Roman';
  const side = m.logoSide || 'right';
  const items = [];

  // Шапка университета — рядом с логотипом, с противоположной стороны
  const headBox = side === 'left' ? { x: LOGO_ZONE, y: 0.2, w: SLIDE_W - LOGO_ZONE - 0.4, h: 1.1 }
                : side === 'right' ? { x: 0.4, y: 0.2, w: SLIDE_W - LOGO_ZONE - 0.4, h: 1.1 }
                : { x: 0.5, y: 0.2, w: 9, h: 1.1 };
  items.push(fitTextItem(headBox, [
    P('ЧАСТНОЕ УЧРЕЖДЕНИЕ'),
    P('ОБРАЗОВАТЕЛЬНАЯ ОРГАНИЗАЦИЯ ВЫСШЕГО ОБРАЗОВАНИЯ'),
    P('МЕДИЦИНСКИЙ УНИВЕРСИТЕТ «РЕАВИЗ»')
  ], F, a.heading, { max: 12, min: 8, align: 'center', valign: 'middle', mult: 1.1 }));

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
  const m = p.meta, F = 'Arial';
  const items = [];
  if (p.bgImage) items.push(rectItem(0, 0, SLIDE_W, SLIDE_H, '000000', 0.5));
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
// ============ РЕНДЕР: CANVAS (превью и PDF) =================
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

  scene.items.forEach(it => {
    if (it.kind === 'rect') {
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
}

function buildPPTX(slides) {
  const p = currentPresentation;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = '';
  pptx.company = '';
  pptx.subject = '';
  pptx.title = p.meta.subject || 'Presentation';

  renderSceneToPptx(pptx, buildTitleScene(p));
  slides.forEach((s, i) => renderSceneToPptx(pptx, buildContentScene(p, s, i).scene));
  return pptx;
}

// ============================================================
// ============ СОЗДАНИЕ ПРЕЗЕНТАЦИИ ==========================
// ============================================================
function describeCount(requested, actual) {
  if (actual > requested) return `Текст не помещался в ${requested} слайдов крупным шрифтом — получилось ${actual}.`;
  if (actual < requested) return `Текста хватило только на ${actual} слайдов из ${requested}.`;
  return '';
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

  const photo = document.getElementById('photoAll').files[0];
  let bgImage = null;
  if (photo) {
    bgImage = await normalizeBackground(await readFileAsDataURL(photo));
  } else if (query) {
    showStatus('⏳ Загружаю фоновое фото…');
    bgImage = await fetchAutoPhoto(query);
    if (!bgImage) showStatus('⚠️ Не удалось загрузить фото, делаю без фона');
  }

  const p = {
    mode: 'free',
    theme: pickRandomTheme(),
    bgImage,
    meta: { fio, group, subject, teacher },
    slides: distributeText(text, slideCount)
  };
  p.slides = autoPaginate(p, p.slides);
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
  if (!bgInput.files[0]) { alert('Загрузи фоновую картинку РЕАВИЗ'); return null; }

  const bgImage = await normalizeBackground(await readFileAsDataURL(bgInput.files[0]));

  const genderSel = document.getElementById('rv_gender').value;
  const studentFemale = genderSel === 'f' ? true : genderSel === 'm' ? false : guessFemale(fio);

  const p = {
    mode: 'reaviz',
    theme: pickReavizAccent(),
    bgImage,
    meta: {
      subject, topic, fio, group, faculty, teacher,
      studentFemale,
      teacherFemale: guessFemale(teacher),
      logoSide: document.getElementById('rv_logo').value,
      cityYear: 'Самара - ' + new Date().getFullYear()
    },
    slides: distributeText(text, slideCount)
  };
  p.slides = autoPaginate(p, p.slides);
  p._requested = slideCount;
  return p;
}

// ============================================================
// ============ ПРЕВЬЮ ========================================
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
}

function renderPreview() {
  const p = currentPresentation;
  const container = document.getElementById('previewSlides');
  container.innerHTML = '';

  // Титульный слайд (только просмотр)
  const t = document.createElement('div');
  t.className = 'preview-slide';
  t.innerHTML = `
    <div class="slide-number">Титул</div>
    <div class="slide-content"><canvas class="thumb"></canvas></div>`;
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
    { heading: slide.heading, body: parts[0] },
    { heading: continuationHeading(slide.heading), body: parts[1] });
  renderPreview();
}

// ============================================================
// ============ СКАЧИВАНИЕ ====================================
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
    const pptx = buildPPTX(slides);
    const defaultName = p.mode === 'reaviz'
      ? (p.meta.fio ? p.meta.fio + ' ' : '') + 'Презентация ' + p.meta.subject
      : 'presentation';
    const filename = prompt('Введите имя файла:', defaultName) || 'presentation';
    await pptx.writeFile({ fileName: filename + '.pptx' });
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
// ============ ПОСЛЕДНЯЯ ПРЕЗЕНТАЦИЯ ==========================
// ============================================================
function saveLast() {
  const p = currentPresentation;
  safeStorage.set('lastPresentation', JSON.stringify({
    mode: p.mode,
    meta: p.meta,
    slides: p.slides,
    theme: p.theme,
    slideCount: p.slides.length + 1,
    date: new Date().toLocaleString('ru-RU')
  }));
  // фон (если влезет в лимит localStorage)
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
      <span style="color:#6a6a85">${escapeHtml(d.date)}</span>
    `;
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
      mode: d.mode, theme: d.theme, bgImage: bg, meta: d.meta, slides: d.slides
    };
    currentPresentation._bgEl = bg ? await loadImage(bg) : null;
    renderPreview();
    openPreview();
    showStatus(bg ? '✅ Данные и фон восстановлены' : '⚠️ Восстановлен текст, но фон надо загрузить заново');
  } catch (e) { alert('Не удалось восстановить'); }
}

// ============================================================
// ============ ГЛАВНЫЕ ФУНКЦИИ ===============================
// ============================================================
async function finishGenerate(p, closeFn) {
  p._bgEl = p.bgImage ? await loadImage(p.bgImage) : null;
  currentPresentation = p;
  closeFn();
  renderPreview();
  openPreview();
  const note = describeCount(p._requested, p.slides.length + 1);
  showStatus('📝 Проверь слайды и скачай' + (note ? ' · ' + note : ''), 9000);
}

async function generateFree() {
  try {
    const p = await buildFreePresentation();
    if (p) await finishGenerate(p, closeModal);
  } catch (err) {
    console.error(err);
    alert('Ошибка: ' + err.message);
  }
}

async function generateReaviz() {
  try {
    const p = await buildReavizPresentation();
    if (p) await finishGenerate(p, closeReavizModal);
  } catch (err) {
    console.error(err);
    alert('Ошибка: ' + err.message);
  }
}

// ============================================================
// ============ СТАРТ =========================================
// ============================================================
initTheme();
updateLastPreview();
