// ============================================================
// ============ СОСТОЯНИЕ И STORAGE ===========================
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

function showStatus(text) {
  const s = document.getElementById('status');
  s.textContent = text;
  s.classList.add('active');
  setTimeout(() => s.classList.remove('active'), 5000);
}

// ============================================================
// ============ ФАЙЛЫ =========================================
// ============================================================
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('Ошибка чтения файла'));
    r.readAsDataURL(file);
  });
}

// ============================================================
// ============ АВТОПОДБОР ФОТО (UNSPLASH) ====================
// ============================================================
async function fetchUnsplashPhoto(query) {
  if (!query) return null;
  try {
    const url = `https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Unsplash недоступен:', e.message);
    return null;
  }
}

// ============================================================
// ============ ТЕМЫ (СВОБОДНЫЙ ШАБЛОН) ======================
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

// ============================================================
// ============ АВТОПОДБОР РАЗМЕРА ШРИФТА ====================
// ============================================================
function pickBodyFontSize(text, baseSize) {
  const len = (text || '').length;
  if (len < 80)   return baseSize + 6;
  if (len < 160)  return baseSize + 4;
  if (len < 300)  return baseSize + 2;
  if (len < 500)  return baseSize;
  if (len < 800)  return baseSize - 1;
  if (len < 1200) return baseSize - 2;
  return baseSize - 3;
}

function pickHeadingFontSize(text) {
  const len = (text || '').length;
  if (len < 20)  return 34;
  if (len < 40)  return 30;
  if (len < 60)  return 26;
  if (len < 90)  return 22;
  return 20;
}

// ============================================================
// ============ РЕАВИЗ: РАНДОМИЗАЦИЯ =========================
// ============================================================
const REAVIZ_ACCENTS = [
  { name: 'navy',  heading: '1F3A6E', line: '2E5AAC' },
  { name: 'bordo', heading: '6B1F2E', line: '8B2F3E' },
  { name: 'green', heading: '1A4D2E', line: '2E7D4E' },
  { name: 'graph', heading: '2A2A2A', line: '4A4A4A' }
];

function pickReavizAccent() {
  return REAVIZ_ACCENTS[Math.floor(Math.random() * REAVIZ_ACCENTS.length)];
}

function jitter(value, range) {
  return value + (Math.random() * 2 - 1) * range;
}

// ============================================================
// ============ РАЗБИВКА ТЕКСТА ===============================
// ============================================================
function splitText(text, maxSlides) {
  let chunks = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (chunks.length > maxSlides - 1) {
    const per = Math.ceil(chunks.length / (maxSlides - 1));
    const merged = [];
    for (let i = 0; i < chunks.length; i += per) merged.push(chunks.slice(i, i + per).join('\n\n'));
    chunks = merged;
  }
  if (chunks.length < maxSlides - 1) {
    const all = chunks.join(' ');
    const sentences = all.split(/(?<=[.!?])\s+/).filter(Boolean);
    const target = Math.min(maxSlides - 1, Math.max(3, Math.ceil(sentences.length / 3)));
    const per = Math.ceil(sentences.length / target);
    chunks = [];
    for (let i = 0; i < sentences.length; i += per) chunks.push(sentences.slice(i, i + per).join(' '));
  }
  return chunks.slice(0, maxSlides - 1);
}

function chunkToSlide(chunk) {
  const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines[0] && lines[0].startsWith('#')) {
    return { heading: lines[0].replace(/^#+\s*/, ''), body: lines.slice(1).join('\n') };
  }
  if (lines.length > 1 && lines[0].length < 90) {
    return { heading: lines[0], body: lines.slice(1).join('\n') };
  }
  const m = chunk.match(/^[^.!?]+[.!?]/);
  if (m && m[0].length < 90) {
    return { heading: m[0].trim(), body: chunk.slice(m[0].length).trim() };
  }
  return { heading: '', body: chunk };
}

// ============================================================
// ============ СБОРКА: СВОБОДНАЯ =============================
// ============================================================
async function buildFreePresentation() {
  const fio = document.getElementById('fio').value.trim() || 'Студент';
  const group = document.getElementById('group').value.trim() || '—';
  const subject = document.getElementById('subject').value.trim() || 'Дисциплина';
  const teacher = document.getElementById('teacher').value.trim() || '—';
  const slideCount = parseInt(document.getElementById('slideCount').value) || 8;
  const text = document.getElementById('content').value.trim();
  const unsplashQuery = document.getElementById('unsplashQuery').value.trim();

  if (!text) { alert('Введите текст презентации'); return null; }

  const photoAllInput = document.getElementById('photoAll');
  let bgImage = null;

  if (photoAllInput.files[0]) {
    bgImage = await readFileAsDataURL(photoAllInput.files[0]);
  } else if (unsplashQuery) {
    showStatus('⏳ Загружаю фоновое фото…');
    bgImage = await fetchUnsplashPhoto(unsplashQuery);
    if (!bgImage) showStatus('⚠️ Не удалось загрузить фото, делаю без фона');
  }

  const theme = pickRandomTheme();
  const chunks = splitText(text, slideCount);
  const slides = chunks.map(chunkToSlide);

  return {
    mode: 'free',
    theme,
    bgImage,
    logoImage: null,
    meta: { fio, group, subject, teacher },
    slides
  };
}

// ============================================================
// ============ СБОРКА: РЕАВИЗ ===============================
// ============================================================
async function buildReavizPresentation() {
  const subject = document.getElementById('rv_subject').value.trim();
  const topic = document.getElementById('rv_topic').value.trim();
  const fio = document.getElementById('rv_fio').value.trim();
  const group = document.getElementById('rv_group').value.trim();
  const faculty = document.getElementById('rv_faculty').value.trim();
  const teacher = document.getElementById('rv_teacher').value.trim();
  const slideCount = parseInt(document.getElementById('rv_slideCount').value) || 9;
  const text = document.getElementById('rv_content').value.trim();
  const bgInput = document.getElementById('rv_bg');

  if (!subject) { alert('Укажи дисциплину'); return null; }
  if (!topic) { alert('Укажи тему'); return null; }
  if (!fio) { alert('Укажи ФИО студента'); return null; }
  if (!teacher) { alert('Укажи, кто проверил'); return null; }
  if (!text) { alert('Вставь текст презентации'); return null; }
  if (!bgInput.files[0]) { alert('Загрузи фоновую картинку РЕАВИЗ'); return null; }

  const bgImage = await readFileAsDataURL(bgInput.files[0]);
  const chunks = splitText(text, slideCount);
  const slides = chunks.map(chunkToSlide);

  const currentYear = new Date().getFullYear();

  return {
    mode: 'reaviz',
    theme: pickReavizAccent(),
    bgImage,
    logoImage: null,
    meta: {
      subject, topic, fio, group, faculty, teacher,
      cityYear: 'Самара - ' + currentYear
    },
    slides
  };
}

// ============================================================
// ============ ПРЕВЬЮ =======================================
// ============================================================
function renderPreview() {
  const container = document.getElementById('previewSlides');
  container.innerHTML = '';

  currentPresentation.slides.forEach((slide, i) => {
    const div = document.createElement('div');
    div.className = 'preview-slide';
    div.innerHTML = `
      <div class="slide-number">#${i + 1}</div>
      <div class="slide-content">
        <input type="text" placeholder="Заголовок" value="${escapeHtml(slide.heading)}" data-idx="${i}" data-field="heading">
        <textarea placeholder="Текст слайда" data-idx="${i}" data-field="body">${escapeHtml(slide.body)}</textarea>
        <div class="slide-actions">
          <button class="mini-btn" onclick="moveSlide(${i}, -1)">↑ Выше</button>
          <button class="mini-btn" onclick="moveSlide(${i}, 1)">↓ Ниже</button>
          <button class="mini-btn" onclick="splitSlide(${i})">✂ Разбить</button>
          <button class="mini-btn danger" onclick="deleteSlide(${i})">🗑 Удалить</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.idx);
      const field = e.target.dataset.field;
      currentPresentation.slides[idx][field] = e.target.value;
    });
  });
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function moveSlide(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= currentPresentation.slides.length) return;
  const slides = currentPresentation.slides;
  [slides[idx], slides[newIdx]] = [slides[newIdx], slides[idx]];
  renderPreview();
}

function deleteSlide(idx) {
  if (currentPresentation.slides.length <= 1) { alert('Нельзя удалить последний слайд'); return; }
  currentPresentation.slides.splice(idx, 1);
  renderPreview();
}

function splitSlide(idx) {
  const slide = currentPresentation.slides[idx];
  const parts = slide.body.split(/\n\s*\n/);
  if (parts.length < 2) { alert('Нет пустой строки для разбивки'); return; }
  const half = Math.ceil(parts.length / 2);
  const s1 = { heading: slide.heading, body: parts.slice(0, half).join('\n\n') };
  const s2 = { heading: 'Продолжение', body: parts.slice(half).join('\n\n') };
  currentPresentation.slides.splice(idx, 1, s1, s2);
  renderPreview();
}

// ============================================================
// ============ PPTX =========================================
// ============================================================
function buildPPTX() {
  const p = currentPresentation;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  pptx.author = '';
  pptx.company = '';
  pptx.subject = '';
  pptx.title = p.meta.subject || 'Presentation';

  if (p.mode === 'free') {
    buildFreePPTX(pptx, p);
  } else {
    buildReavizPPTX(pptx, p);
  }

  return pptx;
}

function buildFreePPTX(pptx, p) {
  const t = p.theme;
  const m = p.meta;

  // ===== ТИТУЛ =====
  const title = pptx.addSlide();
  if (p.bgImage) {
    title.background = { data: p.bgImage };
    title.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: '000000', transparency: 70 }
    });
  } else {
    title.background = { color: '1A2238' };
  }

  title.addText(m.subject.toUpperCase(), {
    x: 0.5, y: 1.6, w: 9, h: 1.6,
    fontSize: 56, bold: true, align: 'center',
    color: 'FFFFFF', fontFace: 'Arial'
  });

  title.addText('Презентация по дисциплине', {
    x: 0.5, y: 3.2, w: 9, h: 0.5,
    fontSize: 16, align: 'center',
    color: 'E0E0E0', fontFace: 'Arial'
  });

  title.addText(
    'Выполнил: ' + m.fio + '\n' +
    'Группа: ' + m.group + '\n' +
    'Проверил: ' + m.teacher,
    {
      x: 1.5, y: 4.0, w: 7, h: 1.5,
      fontSize: 16, align: 'center',
      color: 'E8E8E8', fontFace: 'Arial',
      lineSpacingMultiple: 1.4
    }
  );

  // ===== КОНТЕНТ =====
  p.slides.forEach((slide, i) => {
    const s = pptx.addSlide();
    if (p.bgImage) {
      s.background = { data: p.bgImage };
      s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: '000000', transparency: 70 }
      });
    } else {
      s.background = { color: '1A2238' };
    }

    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.12, h: '100%',
      fill: { color: t.accent }
    });

    s.addText(String(i + 2), {
      x: 9.1, y: 0.25, w: 0.6, h: 0.4,
      fontSize: 13, color: t.accent2, align: 'right', fontFace: 'Arial'
    });

    let headingTop = 0.55;
    let bodyTop = 0.55;
    if (slide.heading) {
      const hSize = pickHeadingFontSize(slide.heading);
      s.addText(slide.heading, {
        x: 0.55, y: headingTop, w: 8.9, h: 1.05,
        fontSize: hSize, bold: true,
        color: t.accent, fontFace: 'Arial',
        valign: 'middle'
      });
      s.addShape(pptx.ShapeType.rect, {
        x: 0.55, y: headingTop + 1.0, w: 1.8, h: 0.045,
        fill: { color: t.accent2 }
      });
      bodyTop = headingTop + 1.2;
    } else {
      bodyTop = 0.5;
    }

    const bodySize = pickBodyFontSize(slide.body, 16);
    const bodyH = 5.4 - bodyTop;

    s.addText(slide.body, {
      x: 0.55, y: bodyTop, w: 8.9, h: bodyH,
      fontSize: bodySize, color: t.text,
      fontFace: 'Arial',
      valign: 'middle',
      lineSpacingMultiple: 1.35
    });
  });
}

function buildReavizPPTX(pptx, p) {
  const accent = p.theme;
  const m = p.meta;

  // ===== ТИТУЛ =====
  const title = pptx.addSlide();
  title.background = { data: p.bgImage };

  title.addText(
    'ЧАСТНОЕ УЧРЕЖДЕНИЕ\nОБРАЗОВАТЕЛЬНАЯ ОРГАНИЗАЦИЯ ВЫСШЕГО ОБРАЗОВАНИЯ\nМЕДИЦИНСКИЙ УНИВЕРСИТЕТ «РЕАВИЗ»',
    {
      x: 2.5, y: jitter(0.25, 0.03), w: 7, h: 1.1,
      fontSize: 11, align: 'center', color: accent.heading,
      fontFace: 'Times New Roman', lineSpacingMultiple: 1.15
    }
  );

  title.addText('Кафедра медико-биологических дисциплин', {
    x: jitter(0.5, 0.05), y: jitter(1.55, 0.05), w: 9, h: 0.4,
    fontSize: 14, bold: true, align: 'center',
    color: '000000', fontFace: 'Times New Roman'
  });

  title.addText(
    'Презентация по дисциплине «' + m.subject + '»\nна тему\n«' + m.topic + '»',
    {
      x: jitter(0.6, 0.05), y: jitter(2.1, 0.05), w: 8.8, h: 1.6,
      fontSize: 15, align: 'center',
      color: '000000', fontFace: 'Times New Roman', lineSpacingMultiple: 1.2
    }
  );

  const execLines = [];
  execLines.push({ text: 'Выполнила студентка ', options: {} });
  if (m.group) execLines.push({ text: 'группы ' + m.group + '\n', options: {} });
  if (m.faculty) execLines.push({ text: m.faculty + '\n', options: {} });
  execLines.push({ text: m.fio, options: {} });

  title.addText(execLines, {
    x: jitter(4.5, 0.05), y: jitter(3.85, 0.05), w: 5, h: 1.0,
    fontSize: 13, align: 'right',
    color: '000000', fontFace: 'Times New Roman', lineSpacingMultiple: 1.15
  });

  title.addText('Проверила\n' + m.teacher, {
    x: jitter(5.0, 0.05), y: jitter(4.85, 0.05), w: 4.5, h: 0.6,
    fontSize: 13, align: 'right',
    color: '000000', fontFace: 'Times New Roman', lineSpacingMultiple: 1.15
  });

  title.addText(m.cityYear, {
    x: 0.5, y: 5.35, w: 9, h: 0.35,
    fontSize: 13, align: 'center',
    color: '000000', fontFace: 'Times New Roman'
  });

  // ===== КОНТЕНТ =====
  p.slides.forEach((slide, i) => {
    const s = pptx.addSlide();
    s.background = { data: p.bgImage };

    const topOffsets = [0.7, 0.85, 1.0];
    const top = topOffsets[Math.floor(Math.random() * topOffsets.length)];

    let bodyTop = top;

    if (slide.heading) {
      const hSize = pickHeadingFontSize(slide.heading);
      s.addText(slide.heading, {
        x: 0.7, y: top, w: 8.6, h: 1.0,
        fontSize: hSize, bold: true,
        color: accent.heading, fontFace: 'Times New Roman',
        valign: 'middle'
      });
      s.addShape(pptx.ShapeType.rect, {
        x: 0.7, y: top + 0.95, w: jitter(2.0, 0.3), h: 0.03,
        fill: { color: accent.line }
      });
      bodyTop = top + 1.15;
    }

    const bodySize = pickBodyFontSize(slide.body, 16);
    const bodyH = 5.4 - bodyTop;

    s.addText(slide.body, {
      x: 0.7, y: bodyTop, w: 8.6, h: bodyH,
      fontSize: bodySize, color: '000000',
      fontFace: 'Times New Roman',
      valign: 'middle',
      lineSpacingMultiple: 1.35
    });
  });
}

// ============================================================
// ============ СКАЧИВАНИЕ PPTX ==============================
// ============================================================
async function downloadPPTX() {
  try {
    const pptx = buildPPTX();
    const p = currentPresentation;
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

// ============================================================
// ============ СКАЧИВАНИЕ PDF ===============================
// ============================================================
async function downloadPDF() {
  try {
    showStatus('⏳ Готовлю PDF…');
    const p = currentPresentation;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1600px';
    container.style.fontFamily = 'Arial, sans-serif';

    // Титул
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `
      width: 1600px; height: 900px; page-break-after: always;
      background: ${p.bgImage ? `url(${p.bgImage}) center/cover` : (p.mode === 'free' ? '#' + p.theme.bg : '#fff')};
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: ${p.bgImage ? 'white' : 'black'};
      padding: 80px; box-sizing: border-box; text-align: center;
      position: relative;
    `;
    if (p.bgImage && p.mode === 'free') {
      titleDiv.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${p.bgImage})`;
    }
    const m = p.meta;
    if (p.mode === 'reaviz') {
      titleDiv.style.background = `url(${p.bgImage}) center/cover`;
      titleDiv.style.color = 'black';
      titleDiv.innerHTML = `
        <div style="font-size: 22px; color: ${p.theme.heading}; margin-bottom: 30px; text-align: center; max-width: 1200px; line-height: 1.3;">
          ЧАСТНОЕ УЧРЕЖДЕНИЕ<br>
          ОБРАЗОВАТЕЛЬНАЯ ОРГАНИЗАЦИЯ ВЫСШЕГО ОБРАЗОВАНИЯ<br>
          МЕДИЦИНСКИЙ УНИВЕРСИТЕТ «РЕАВИЗ»
        </div>
        <div style="font-size: 26px; font-weight: bold; margin-bottom: 40px;">Кафедра медико-биологических дисциплин</div>
        <div style="font-size: 26px; margin-bottom: 60px; max-width: 1200px; line-height: 1.5;">
          Презентация по дисциплине «${m.subject}»<br>на тему<br>«${m.topic}»
        </div>
        <div style="font-size: 22px; text-align: right; align-self: flex-end; margin-right: 100px;">
          Выполнила студентка ${m.group ? 'группы ' + m.group + '<br>' : ''}${m.faculty ? m.faculty + '<br>' : ''}${m.fio}<br><br>
          Проверила<br>${m.teacher}
        </div>
        <div style="font-size: 22px; margin-top: auto;">${m.cityYear}</div>
      `;
    } else {
      titleDiv.innerHTML = `
        <div style="font-size: 72px; font-weight: bold; margin-bottom: 40px;">${m.subject.toUpperCase()}</div>
        <div style="font-size: 24px; margin-bottom: 100px;">Презентация по дисциплине</div>
        <div style="font-size: 24px; line-height: 1.6;">
          Выполнил: ${m.fio}<br>
          Группа: ${m.group}<br>
          Проверил: ${m.teacher}
        </div>
      `;
    }
    container.appendChild(titleDiv);

    // Контент
    p.slides.forEach(slide => {
      const div = document.createElement('div');
      div.style.cssText = `
        width: 1600px; height: 900px; page-break-after: always;
        background: ${p.bgImage ? `url(${p.bgImage}) center/cover` : (p.mode === 'free' ? '#' + p.theme.bg : '#fff')};
        color: ${p.bgImage ? 'black' : (p.mode === 'free' ? '#' + p.theme.text : 'black')};
        padding: 80px; box-sizing: border-box;
        display: flex; flex-direction: column; justify-content: center;
        font-family: ${p.mode === 'reaviz' ? '"Times New Roman", serif' : 'Arial, sans-serif'};
      `;
      if (p.bgImage && p.mode === 'free') {
        div.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${p.bgImage})`;
        div.style.color = 'white';
      }
      div.innerHTML = `
        ${slide.heading ? `<div style="font-size: 42px; font-weight: bold; color: ${p.mode === 'reaviz' ? p.theme.heading : (p.bgImage ? 'white' : '#' + p.theme.accent)}; margin-bottom: 30px;">${escapeHtml(slide.heading)}</div>` : ''}
        <div style="font-size: 22px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(slide.body)}</div>
      `;
      container.appendChild(div);
    });

    document.body.appendChild(container);

    const filename = prompt('Имя PDF-файла:', 'presentation') || 'presentation';

    await html2pdf().set({
      margin: 0,
      filename: filename + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 1, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'px', format: [1600, 900], orientation: 'landscape' }
    }).from(container).save();

    document.body.removeChild(container);
    saveLast();
    showStatus('✅ PDF сохранён!');
  } catch (err) {
    console.error(err);
    alert('Ошибка PDF: ' + err.message);
  }
}

// ============================================================
// ============ СОХРАНЕНИЕ ===================================
// ============================================================
function saveLast() {
  const p = currentPresentation;
  const data = {
    mode: p.mode,
    meta: p.meta,
    slides: p.slides,
    theme: p.theme,
    slideCount: p.slides.length,
    date: new Date().toLocaleString('ru-RU')
  };
  safeStorage.set('lastPresentation', JSON.stringify(data));
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
      ${d.meta.subject || '—'}<br>
      ${d.meta.fio}${d.meta.group ? ' • ' + d.meta.group : ''}<br>
      Слайдов: ${d.slideCount}<br>
      <span style="color:#6a6a85">${d.date}</span>
    `;
    btn.disabled = false;
  } catch (e) {
    preview.textContent = 'Пока нет созданных презентаций';
    btn.disabled = true;
  }
}

function recreateLast() {
  const raw = safeStorage.get('lastPresentation');
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    currentPresentation = {
      mode: d.mode,
      theme: d.theme,
      bgImage: null,
      logoImage: null,
      meta: d.meta,
      slides: d.slides
    };
    renderPreview();
    openPreview();
    showStatus('⚠️ Восстановлен текст, но фон надо загрузить заново');
  } catch (e) { alert('Не удалось восстановить'); }
}

// ============================================================
// ============ ГЛАВНЫЕ ФУНКЦИИ ==============================
// ============================================================
async function generateFree() {
  try {
    const p = await buildFreePresentation();
    if (!p) return;
    currentPresentation = p;
    closeModal();
    renderPreview();
    openPreview();
    showStatus('📝 Проверь слайды и скачай');
  } catch (err) {
    console.error(err);
    alert('Ошибка: ' + err.message);
  }
}

async function generateReaviz() {
  try {
    const p = await buildReavizPresentation();
    if (!p) return;
    currentPresentation = p;
    closeReavizModal();
    renderPreview();
    openPreview();
    showStatus('📝 Проверь слайды и скачай');
  } catch (err) {
    console.error(err);
    alert('Ошибка: ' + err.message);
  }
}

// ============================================================
// ============ СТАРТ ========================================
// ============================================================
initTheme();
updateLastPreview();