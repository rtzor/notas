let slides = [];
let slidesNotes = [];
let slidesMeta = [];
let currentIndex = 0;
let currentFragmentIndex = 0;
let currentFragmentTotal = 0;
let notesVisible = false;
let renderTimer = null;
let renderToken = 0;
let autoplayTimer = null;
let matrixAnimFrame = null;
let matrixCanvas = null;
const isSpeakerView = window.location.pathname.endsWith('/speaker.html');
const syncChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('slides-sync')
  : null;
let speakerWindowRef = null;
let speakerStartTime = null;
let speakerTimerId = null;

function getIndexFromHash() {
  const hash = parseInt(window.location.hash.replace('#', ''), 10);
  return (Number.isFinite(hash) && hash >= 1) ? hash - 1 : 0;
}

function setHash(index) {
  history.replaceState(null, '', `#${index + 1}`);
}

function clampIndex(index) {
  if (slides.length === 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), slides.length - 1);
}

function updateProgress() {
  const bar = document.getElementById('progress-fill');
  if (!bar) {
    return;
  }
  const pct = slides.length <= 1 ? 100 : (currentIndex / (slides.length - 1)) * 100;
  bar.style.width = `${pct}%`;
}

async function loadSlides() {
  slides = [];
  slidesNotes = [];
  slidesMeta = [];

  for (let i = 1; i <= 999; i++) {
    try {
      const response = await fetch(`${i}.md`, { cache: 'no-store' });
      if (!response.ok) {
        break;
      }
      const raw = await response.text();
      const { content, notes, meta } = extractNotes(raw);
      slides.push(content);
      slidesNotes.push(notes);
      slidesMeta.push(meta);
    } catch (err) {
      console.error(`Error al cargar ${i}.md:`, err);
      break;
    }
  }
  return slides;
}

async function refreshSlides() {
  const previousIndex = currentIndex;
  const previousFragmentIndex = currentFragmentIndex;

  await loadSlides();

  currentIndex = clampIndex(previousIndex);
  currentFragmentIndex = previousIndex === currentIndex ? previousFragmentIndex : 0;
  currentFragmentTotal = 0;
  updateUI();
}

function extractNotes(raw) {
  const normalizedRaw = (raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalizedRaw.split('\n');
  const noteLines = [];
  const contentLines = [];
  const meta = {
    layout: null,
    image: null,
    embed: null,
    embedHeight: null,
    embedStep: null,
    embedExpandStep: null,
    autoplay: null,
    background: null,
    bgImage: null
  };
  let inNoteBlock = false;

  for (const line of lines) {
    const metadataMatch = line.match(/^<!--\s*([a-z-]+)\s*:\s*([^>]+?)\s*-->$/i);
    if (metadataMatch) {
      const key = metadataMatch[1].toLowerCase();
      const rawValue = metadataMatch[2].trim();
      const value = rawValue.toLowerCase();
      if (key === 'layout') {
        meta.layout = value;
      } else if (key === 'image') {
        meta.image = value;
      } else if (key === 'embed') {
        meta.embed = rawValue;
      } else if (key === 'embed-height') {
        const parsedHeight = parseInt(rawValue, 10);
        if (Number.isFinite(parsedHeight) && parsedHeight > 0) {
          meta.embedHeight = parsedHeight;
        }
      } else if (key === 'embed-step') {
        const parsedStep = parseInt(rawValue, 10);
        if (Number.isFinite(parsedStep) && parsedStep > 0) {
          meta.embedStep = parsedStep;
        }
      } else if (key === 'embed-expand-step') {
        const parsedStep = parseInt(rawValue, 10);
        if (Number.isFinite(parsedStep) && parsedStep > 0) {
          meta.embedExpandStep = parsedStep;
        }
      } else if (key === 'autoplay') {
        const parsedDelay = parseInt(rawValue, 10);
        if (Number.isFinite(parsedDelay) && parsedDelay > 0) {
          meta.autoplay = parsedDelay;
        }
      } else if (key === 'background') {
        meta.background = value;
      } else if (key === 'bg-image') {
        meta.bgImage = rawValue;
      } else {
        // Directiva desconocida — pasarla al contenido para que buildRevealHtml la procese
        contentLines.push(line);
      }
    } else if (/^>\s*\*\*Nota del presentador:\*\*/.test(line)) {
      inNoteBlock = true;
      noteLines.push(line.replace(/^>\s*\*\*Nota del presentador:\*\*\s*/, '').trim());
    } else if (inNoteBlock && /^>\s*/.test(line)) {
      noteLines.push(line.replace(/^>\s*/, '').trim());
    } else {
      inNoteBlock = false;
      contentLines.push(line);
    }
  }

  return {
    content: contentLines.join('\n').trimEnd(),
    notes: noteLines.join(' ').trim(),
    meta
  };
}

function buildColumnsHtml(markdown) {
  const normalizedMarkdown = (markdown || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const parts = normalizedMarkdown.split(/<!--\s*column\s*-->/i);
  if (parts.length < 2) {
    return null;
  }

  let prefaceHtml = '';
  const headingMatch = parts[0].match(/^\s*(#[^\n]+)\s*\n+/);
  if (headingMatch) {
    const headingMarkdown = headingMatch[1].trim();
    prefaceHtml = (typeof marked !== 'undefined') ? marked.parse(headingMarkdown) : headingMarkdown;
    parts[0] = parts[0].slice(headingMatch[0].length).trimStart();
  }

  const columns = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `
      <section class="slide-column">
        ${(typeof marked !== 'undefined') ? marked.parse(part) : part}
      </section>
    `)
    .join('');

  return `${prefaceHtml}<div class="slide-columns">${columns}</div>`;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function buildEmbedHtml(meta = {}) {
  if (!meta.embed) {
    return '';
  }

  const src = escapeAttribute(meta.embed);
  const height = meta.embedHeight || 420;
  const fragmentAttr = meta.embedStep ? ` data-fragment-index="${meta.embedStep}"` : '';

  return `
    <section class="slide-embed-frame"${fragmentAttr} style="--embed-height:${height}px;">
      <div class="slide-embed-chrome">
        <span class="slide-embed-dot"></span>
        <span class="slide-embed-dot"></span>
        <span class="slide-embed-dot"></span>
        <span class="slide-embed-label">${src}</span>
      </div>
      <div class="slide-embed-body">
        <iframe
          class="slide-embed-iframe"
          src="${src}"
          title="Vista incrustada de ${src}"
          loading="lazy"
          referrerpolicy="no-referrer"
        ></iframe>
      </div>
    </section>
  `;
}

function processCallouts(html) {
  return html.replace(
    /<blockquote>\n?<p>\[!(NOTE|WARNING|TIP|DANGER)\]\n?([\s\S]*?)<\/p>\n?<\/blockquote>/gi,
    (match, type, content) => {
      const icons = { NOTE: 'ℹ️', WARNING: '⚠️', TIP: '💡', DANGER: '☠️' };
      const icon = icons[type.toUpperCase()] || '';
      return `<div class="callout callout-${type.toLowerCase()}"><span class="callout-icon">${icon}</span><div class="callout-body"><p>${content.trim()}</p></div></div>`;
    }
  );
}

function renderContentHtml(markdown, meta = {}) {
  const normalizedMeta = meta || {};

  if (normalizedMeta.layout === 'two-columns') {
    const columnsHtml = buildColumnsHtml(markdown || '');
    if (columnsHtml) {
      return columnsHtml;
    }
  }

  const rawHtml = (typeof marked !== 'undefined')
    ? marked.parse(markdown || '')
    : (markdown || '');
  return processCallouts(rawHtml);
}

function buildRevealHtml(markdown, meta = {}) {
  const normalizedMarkdown = (markdown || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const parts = normalizedMarkdown.split(/<!--\s*reveal\s*-->/i);

  if (parts.length < 2) {
    return renderContentHtml(normalizedMarkdown, meta);
  }

  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const hideFromMatch = part.match(/<!--\s*hide-from\s*:\s*(\d+)\s*-->/i);
      let html;
      if (hideFromMatch) {
        const hideFrom = hideFromMatch[1];
        const splitParts = part.split(/<!--\s*hide-from\s*:\s*\d+\s*-->/i);
        const beforeHtml = splitParts[0].trim() ? renderContentHtml(splitParts[0].trim(), meta) : '';
        const afterHtml = splitParts.slice(1).join('').trim() ? renderContentHtml(splitParts.slice(1).join('').trim(), meta) : '';
        html = beforeHtml + `<div data-hide-from="${hideFrom}">${afterHtml}</div>`;
      } else {
        html = renderContentHtml(part, meta);
      }
      if (index === 0) {
        return html;
      }
      return `<div class="slide-fragment" data-fragment-index="${index}">${html}</div>`;
    })
    .join('');
}

function stopMatrixBackground() {
  if (matrixAnimFrame !== null) {
    cancelAnimationFrame(matrixAnimFrame);
    matrixAnimFrame = null;
  }
  if (matrixCanvas) {
    if (matrixCanvas._ro) { matrixCanvas._ro.disconnect(); }
    if (matrixCanvas.parentNode) { matrixCanvas.parentNode.removeChild(matrixCanvas); }
    matrixCanvas = null;
  }
}

function startMatrixBackground(opts = {}) {
  const frame = document.getElementById('slide-frame');
  if (!frame) { return; }

  const {
    maxOpacity = 0.18,
    speedMin = 0.25,
    speedMax = 0.7,
    fadeAlpha = 0,     // >0 = classic dark-fill trail (slide 1); 0 = explicit trail (subtle)
    trailLength = 6,   // used when fadeAlpha === 0
    density = 0.45,
    bgAlpha = 0
  } = opts;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  frame.insertBefore(canvas, frame.firstChild);
  matrixCanvas = canvas;

  const ctx = canvas.getContext('2d');
  const charColor = '#39ff14';
  const fontSize = 13;
  const chars = '01<>/{}+=-_*[]()!#$@ABCDEF01'.split('');
  let columns = [];

  function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function initCols() {
    columns = [];
    const numCols = Math.floor(canvas.width / fontSize);
    for (let i = 0; i < numCols; i++) {
      if (Math.random() > density) { continue; }
      columns.push({
        x: i * fontSize,
        y: Math.random() * -canvas.height,
        speed: Math.random() * (speedMax - speedMin) + speedMin,
        trail: []
      });
    }
  }

  function resize() {
    canvas.width = frame.offsetWidth;
    canvas.height = frame.offsetHeight;
    if (bgAlpha > 0) {
      ctx.fillStyle = `rgba(8, 11, 22, ${bgAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    initCols();
  }

  function draw() {
    if (matrixCanvas !== canvas) { return; }
    ctx.font = `${fontSize}px "Cascadia Code", Consolas, monospace`;

    if (fadeAlpha > 0) {
      // Classic: dark overlay creates trail effect (slide 1)
      ctx.fillStyle = `rgba(8, 11, 22, ${fadeAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const col of columns) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const opacity = Math.min(maxOpacity, Math.max(0.03, maxOpacity * (1 - col.y / canvas.height)));
        ctx.fillStyle = hexToRGBA(charColor, opacity);
        ctx.fillText(char, col.x, col.y);
        col.y += col.speed;
        if (col.y > canvas.height && Math.random() > 0.975) {
          col.y = -20;
          col.speed = Math.random() * (speedMax - speedMin) + speedMin;
        }
      }
    } else {
      // Subtle: transparent canvas, explicit trail arrays (no background darkening)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const col of columns) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        // Draw trail (oldest = most transparent)
        for (let t = 0; t < col.trail.length; t++) {
          const frac = (t + 1) / (trailLength + 1);
          ctx.fillStyle = hexToRGBA(charColor, maxOpacity * frac * 0.5);
          ctx.fillText(col.trail[t].ch, col.x, col.trail[t].y);
        }
        // Draw head
        ctx.fillStyle = hexToRGBA(charColor, maxOpacity);
        ctx.fillText(char, col.x, col.y);
        // Store trail entry
        col.trail.unshift({ y: col.y, ch: char });
        if (col.trail.length > trailLength) { col.trail.pop(); }
        col.y += col.speed;
        if (col.y > canvas.height && Math.random() > 0.975) {
          col.y = -20;
          col.speed = Math.random() * (speedMax - speedMin) + speedMin;
          col.trail = [];
        }
      }
    }

    matrixAnimFrame = requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(frame);
  canvas._ro = ro;
  resize();
  draw();
}

function addCopyButtons(container) {
  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement && pre.parentElement.classList.contains('pre-wrapper')) {
      return;
    }
    const code = pre.querySelector('code');
    if (!code) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'pre-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', 'Copiar código');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = code.innerText;
      navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
          btn.classList.remove('copied');
        }, 1800);
      }).catch(() => {
        const range = document.createRange();
        range.selectNodeContents(code);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    });

    wrapper.appendChild(btn);
  });
}

function renderMarkdown(markdown, meta = {}) {
  const normalizedMeta = meta || {};
  const embedHtml = buildEmbedHtml(normalizedMeta);

  const contentHtml = buildRevealHtml(markdown, normalizedMeta);

  return `${contentHtml}${embedHtml}`;
}

function renderSlide(index) {
  const container = document.getElementById('slide-content');
  if (!container) {
    return;
  }

  if (slides.length === 0) {
    container.innerHTML = '<p>No hay notas disponibles.</p>';
    return;
  }

  if (renderTimer !== null) {
    clearTimeout(renderTimer);
  }

  if (autoplayTimer !== null) {
    clearTimeout(autoplayTimer);
    autoplayTimer = null;
    document.querySelector('.autoplay-indicator')?.remove();
  }

  const currentRenderToken = ++renderToken;
  container.classList.add('fade-out');

  renderTimer = setTimeout(() => {
    if (currentRenderToken !== renderToken) {
      return;
    }

    const html = renderMarkdown(slides[index], slidesMeta[index]);
    container.innerHTML = html;

    // Resaltado de sintaxis
    if (typeof hljs !== 'undefined') {
      container.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }
    addCopyButtons(container);

    stopMatrixBackground();
    const frame = document.getElementById('slide-frame');
    const bg = (slidesMeta[index] || {}).background || '';
    const bgImage = (slidesMeta[index] || {}).bgImage || '';
    const imgSrc = bgImage || (bg !== 'matrix' ? bg : '');
    if (imgSrc && frame) {
      frame.style.backgroundImage = `linear-gradient(180deg, rgba(8,11,22,0.65), rgba(8,11,22,0.75)), url('${imgSrc}')`;
      frame.style.backgroundSize = 'auto, cover';
      frame.style.backgroundPosition = 'center, center';
    } else if (frame) {
      frame.style.backgroundImage = '';
      frame.style.backgroundSize = '';
      frame.style.backgroundPosition = '';
    }
    if (bg === 'matrix') {
      if (bgImage) {
        // Combined: transparent canvas matrix over darkened image
        startMatrixBackground({
          maxOpacity: 0.6, speedMin: 0.6, speedMax: 2.1,
          fadeAlpha: 0, trailLength: 5, density: 1, bgAlpha: 0
        });
      } else {
        startMatrixBackground({
          maxOpacity: 0.5, minOpacity: 0.03,
          speedMin: 0.6, speedMax: 2.1,
          fadeAlpha: 0.13, density: 1, bgAlpha: 0.94
        });
      }
    } else {
      startMatrixBackground();
    }

    applySlideLayout(container, slidesMeta[index]);
    enhanceSlideImages(container, slidesMeta[index]);
    applyFragmentState(container, currentFragmentIndex);
    updateControls();
    broadcastState();

    // Actualizar notas del presentador
    const notesContent = document.getElementById('notes-content');
    if (notesContent) {
      notesContent.textContent = slidesNotes[index] || '';
    }

    container.classList.remove('fade-out');

    // Autoplay
    const autoplayDelay = (slidesMeta[index] || {}).autoplay;
    if (autoplayDelay) {
      const indicator = document.createElement('div');
      indicator.className = 'autoplay-indicator';
      indicator.style.animationDuration = `${autoplayDelay}s`;
      document.getElementById('slide-frame')?.appendChild(indicator);
      autoplayTimer = setTimeout(() => {
        document.querySelector('.autoplay-indicator')?.remove();
        autoplayTimer = null;
        if (currentIndex < slides.length - 1) {
          goToSlide(currentIndex + 1);
        }
      }, autoplayDelay * 1000);
    }

    renderTimer = null;
  }, 200);
}

function applyFragmentState(container, fragmentIndex) {
  const fragments = [...container.querySelectorAll('[data-fragment-index]')]
    .sort((left, right) => Number(left.dataset.fragmentIndex) - Number(right.dataset.fragmentIndex));

  currentFragmentTotal = fragments.reduce((max, fragment) => {
    const index = Number(fragment.dataset.fragmentIndex) || 0;
    return Math.max(max, index);
  }, 0);

  const expandStep = (slidesMeta[currentIndex] || {}).embedExpandStep;
  if (expandStep) {
    currentFragmentTotal = Math.max(currentFragmentTotal, expandStep);
  }

  currentFragmentIndex = Math.min(Math.max(fragmentIndex, 0), currentFragmentTotal);

  fragments.forEach((fragment) => {
    const index = Number(fragment.dataset.fragmentIndex) || 0;
    const isRevealed = index <= currentFragmentIndex;
    fragment.classList.toggle('is-revealed', isRevealed);
    fragment.classList.toggle('is-hidden-fragment', !isRevealed);
    fragment.setAttribute('aria-hidden', String(!isRevealed));
  });

  container.querySelectorAll('[data-hide-from]').forEach((el) => {
    const hideFrom = Number(el.dataset.hideFrom);
    const shouldHide = currentFragmentIndex >= hideFrom;
    el.classList.toggle('is-hidden-fragment', shouldHide);
    el.setAttribute('aria-hidden', String(shouldHide));
  });

  container.classList.toggle('embed-expanded', !!(expandStep && currentFragmentIndex >= expandStep));
}

function revealNextFragment() {
  if (currentFragmentIndex >= currentFragmentTotal) {
    return false;
  }

  const container = document.getElementById('slide-content');
  if (!container) {
    return false;
  }

  applyFragmentState(container, currentFragmentIndex + 1);
  updateControls();
  broadcastState();
  return true;
}

function hidePreviousFragment() {
  if (currentFragmentIndex <= 0) {
    return false;
  }

  const container = document.getElementById('slide-content');
  if (!container) {
    return false;
  }

  applyFragmentState(container, currentFragmentIndex - 1);
  updateControls();
  broadcastState();
  return true;
}

function applySlideLayout(container, meta = {}) {
  const hasTable = container.querySelector('table') !== null;
  const hasCode = container.querySelector('pre') !== null;
  const hasImage = container.querySelector('img') !== null;
  const hasEmbed = container.querySelector('.slide-embed-frame') !== null;
  const headingCount = container.querySelectorAll('h1, h2, h3').length;
  const paragraphCount = container.querySelectorAll('p, li').length;

  container.classList.remove(
    'hero-layout',
    'title-layout',
    'table-layout',
    'code-layout',
    'two-columns-layout',
    'split-code-layout',
    'media-layout',
    'image-hero-layout',
    'embed-layout'
  );

  if (meta.layout === 'title') {
    container.classList.add('title-layout');
    return;
  }

  if (meta.layout === 'two-columns') {
    container.classList.add('two-columns-layout');
    return;
  }

  if (meta.layout === 'split-code') {
    container.classList.add('split-code-layout');
    return;
  }

  if (meta.layout === 'media-right' || meta.layout === 'media-left') {
    container.classList.add('media-layout', meta.layout);
  }

  if (meta.image === 'hero') {
    container.classList.add('image-hero-layout');
  }

  if (hasTable) {
    container.classList.add('table-layout');
  }

  if (hasCode) {
    container.classList.add('code-layout');
  }

  if (hasImage) {
    container.classList.add('media-layout');
  }

  if (hasEmbed) {
    container.classList.add('embed-layout');
  }

  if (!hasTable && !hasCode && !hasEmbed && headingCount <= 2 && paragraphCount <= 4) {
    container.classList.add('hero-layout');
  }
}

function enhanceSlideImages(container, meta = {}) {
  const images = container.querySelectorAll('img');
  images.forEach((image, index) => {
    image.loading = 'eager';
    image.decoding = 'async';

    if (image.closest('figure.slide-media') || image.hasAttribute('data-raw')) {
      return;
    }

    const paragraph = image.closest('p');
    const isStandalone = paragraph && paragraph.childNodes.length === 1;
    const figure = document.createElement('figure');
    figure.className = 'slide-media';

    if (meta.image === 'hero') {
      figure.classList.add('slide-media-hero');
    } else if (index === 0 && images.length === 1) {
      figure.classList.add('slide-media-feature');
    }

    if (isStandalone) {
      paragraph.replaceWith(figure);
    } else {
      image.parentNode.insertBefore(figure, image);
    }

    figure.appendChild(image);

    if (image.alt && image.alt.trim()) {
      const caption = document.createElement('figcaption');
      caption.textContent = image.alt.trim();
      figure.appendChild(caption);
    }
  });
}

function updateControls() {
  const prevButton = document.getElementById('btn-prev');
  const nextButton = document.getElementById('btn-next');
  const counter = document.getElementById('counter');

  if (!prevButton || !nextButton || !counter) {
    return;
  }

  prevButton.disabled = currentIndex === 0 && currentFragmentIndex === 0;
  nextButton.disabled = slides.length === 0 || (currentIndex === slides.length - 1 && currentFragmentIndex === currentFragmentTotal);
  counter.textContent = slides.length > 0
    ? `${currentIndex + 1} / ${slides.length}`
    : '';

  const frame = document.getElementById('slide-frame');
  if (frame) {
    const isReadyForNext = currentFragmentIndex >= currentFragmentTotal && currentIndex < slides.length - 1;
    frame.classList.toggle('is-last-fragment', isReadyForNext);
  }
}

function updateUI() {
  renderSlide(currentIndex);
  updateProgress();
}

function goToSlide(index, syncHash = true) {
  const nextIndex = clampIndex(index);

  if (slides.length === 0) {
    currentIndex = 0;
    updateUI();
    return;
  }

  const slideChanged = nextIndex !== currentIndex;
  currentIndex = nextIndex;
  if (slideChanged) {
    currentFragmentIndex = 0;
    currentFragmentTotal = 0;
  }
  if (syncHash) {
    setHash(currentIndex);
  }
  updateUI();
}

function syncFromHash() {
  goToSlide(getIndexFromHash(), false);
}

function getSyncPayload() {
  return {
    currentIndex,
    currentFragmentIndex,
    currentFragmentTotal,
    totalSlides: slides.length,
    currentSlide: slides[currentIndex] || '',
    currentMeta: slidesMeta[currentIndex] || {},
    nextSlide: slides[currentIndex + 1] || '',
    nextMeta: slidesMeta[currentIndex + 1] || {},
    currentNotes: slidesNotes[currentIndex] || '',
    nextNotes: slidesNotes[currentIndex + 1] || '',
    startedAt: speakerStartTime
  };
}

function broadcastState() {
  const payload = getSyncPayload();

  if (syncChannel) {
    syncChannel.postMessage({ type: 'slide-state', payload });
  }

  try {
    localStorage.setItem('slides-sync-state', JSON.stringify(payload));
  } catch (err) {
    console.error('No se pudo sincronizar el estado:', err);
  }
}

function renderMarkdownToElement(element, markdown, meta = {}, fragmentIndex = 0) {
  if (!element) {
    return;
  }

  const html = renderMarkdown(markdown, meta);

  element.innerHTML = html;

  if (typeof hljs !== 'undefined') {
    element.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  applySlideLayout(element, meta);
  enhanceSlideImages(element, meta);
  applyFragmentState(element, fragmentIndex);
}

function updateSpeakerTimer(startedAt) {
  const elapsedNode = document.getElementById('speaker-elapsed');
  if (!elapsedNode) {
    return;
  }

  if (!startedAt) {
    elapsedNode.textContent = '00:00';
    return;
  }

  const elapsedMs = Date.now() - startedAt;
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  elapsedNode.textContent = `${minutes}:${seconds}`;
}

function applySpeakerState(payload) {
  const currentPanel = document.getElementById('speaker-current-slide');
  const nextPanel = document.getElementById('speaker-next-slide');
  const currentNotes = document.getElementById('speaker-current-notes');
  const nextNotes = document.getElementById('speaker-next-notes');
  const meta = document.getElementById('speaker-meta');

  renderMarkdownToElement(currentPanel, payload.currentSlide, payload.currentMeta, payload.currentFragmentIndex || 0);
  renderMarkdownToElement(nextPanel, payload.nextSlide || '_Fin de la presentación_', payload.nextMeta, 0);

  if (currentNotes) {
    currentNotes.textContent = payload.currentNotes || 'Sin notas para esta slide.';
  }

  if (nextNotes) {
    nextNotes.textContent = payload.nextNotes || 'Sin notas para la siguiente slide.';
  }

  if (meta) {
    meta.textContent = payload.totalSlides > 0
      ? `Slide ${payload.currentIndex + 1} de ${payload.totalSlides}`
      : 'Sin slides cargadas';
  }

  updateSpeakerTimer(payload.startedAt);
}

function connectSpeakerSync() {
  const syncHandler = (payload) => {
    applySpeakerState(payload);
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', (event) => {
      if (event.data?.type === 'slide-state') {
        syncHandler(event.data.payload);
      }
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'slides-sync-state' && event.newValue) {
      syncHandler(JSON.parse(event.newValue));
    }
  });

  try {
    const cached = localStorage.getItem('slides-sync-state');
    if (cached) {
      syncHandler(JSON.parse(cached));
    }
  } catch (err) {
    console.error('No se pudo leer el estado sincronizado:', err);
  }
}

function openSpeakerView() {
  if (isSpeakerView) {
    return;
  }

  if (!speakerWindowRef || speakerWindowRef.closed) {
    speakerWindowRef = window.open('speaker.html', 'speaker-view', 'popup,width=1440,height=900');
  } else {
    speakerWindowRef.focus();
  }

  broadcastState();
}

function initSpeakerView() {
  speakerStartTime = Date.now();
  connectSpeakerSync();
  updateSpeakerTimer(speakerStartTime);
  speakerTimerId = window.setInterval(() => {
    const cached = (() => {
      try {
        return JSON.parse(localStorage.getItem('slides-sync-state') || 'null');
      } catch (err) {
        return null;
      }
    })();
    updateSpeakerTimer(cached?.startedAt || speakerStartTime);
  }, 1000);
}

function initMainView() {
  speakerStartTime = Date.now();
  currentIndex = clampIndex(getIndexFromHash());
  updateUI();

  document.getElementById('btn-prev').addEventListener('click', () => {
    if (hidePreviousFragment()) {
      return;
    }

    if (currentIndex > 0) {
      goToSlide(currentIndex - 1);
    }
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    if (revealNextFragment()) {
      return;
    }

    if (currentIndex < slides.length - 1) {
      goToSlide(currentIndex + 1);
    }
  });

  const slideFrame = document.getElementById('slide-frame');
  if (slideFrame) {
    slideFrame.addEventListener('click', (event) => {
      if (event.target.closest('button, a, iframe, input, textarea')) {
        return;
      }

      document.getElementById('btn-next')?.click();
    });
  }

  const speakerButton = document.getElementById('btn-speaker');
  if (speakerButton) {
    speakerButton.addEventListener('click', openSpeakerView);
  }

  window.addEventListener('hashchange', syncFromHash);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      document.getElementById('btn-prev').click();
    } else if (e.key === 'ArrowRight') {
      document.getElementById('btn-next').click();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-next').click();
    } else if (e.key === 'p' || e.key === 'P') {
      notesVisible = !notesVisible;
      document.getElementById('notes-panel').classList.toggle('visible', notesVisible);
    } else if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } else if (e.key === 'r' || e.key === 'R') {
      refreshSlides().catch((err) => {
        console.error('No se pudieron refrescar las slides:', err);
      });
    } else if (e.key === 's' || e.key === 'S') {
      openSpeakerView();
    }
  });

  window.addEventListener('focus', () => {
    refreshSlides().catch((err) => {
      console.error('No se pudieron refrescar las slides:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSlides();
  if (isSpeakerView) {
    initSpeakerView();
  } else {
    initMainView();
  }
});
