// ============================
//  KONSTANTEN & BASIS-DATEN
// ============================
const PIECES = [
  { id: 'rook',   name: 'Turm',    value: '-/+3', base: 3 },
  { id: 'bishop', name: 'Läufer',  value: '-1',   base: 1 },
  { id: 'knight', name: 'Springer',value: '?',    base: 1 },
  { id: 'queen',  name: 'Dame',    value: '+1',   base: 1 },
  { id: 'king',   name: 'König',   value: '+/-3', base: 3 },
];
const PIECE_IDS = PIECES.map(p => p.id);
const SIDES = ['white', 'black'];
const POLARITIES = ['positive', 'negative'];
const QUESTION_VALUES = [-3, -2, -1, 1, 2, 3];

// Wikimedia Commons Cburnett chess piece SVGs
const PIECE_SVG_URLS = {
  rook:   'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  bishop: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  knight: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  queen:  'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  king:   'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
};

// ============================
//  ZUSTAND
// ============================
const initialBonuses = {
  white: { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 },
  black: { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 },
};

const state = {
  theses: Array.from({ length: 12 }, (_, i) => `These ${i + 1}`),
  assignments: Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    side: null,
    piece: null,
    polarity: null,
    knightSwing: Math.random() > 0.5 ? 1 : -1,
  })),
  results: cloneData(initialBonuses),
  figureImages: {},
  questionValue: null,
};

const teamLogos = { white: null, black: null };

// DOM-Referenzen
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const nameInputs = {
  white: $('#whiteName'),
  black: $('#blackName'),
};
const pieceGrid = $('#pieceGrid');
const thesisList = $('#thesisList');
const evaluationList = $('#evaluationList');
const resultsGrid = $('#resultsGrid');
const settingsDialog = $('#settingsDialog');
const openSettingsBtn = $('#openSettingsButton');
const closeSettingsBtn = $('#closeSettingsButton');
const randomQuestionBtn = $('#randomQuestionButton');
const questionValueLabel = $('#questionValueLabel');
const exportAllBtn = $('#exportAllButton');
const importAllBtn = $('#importAllButton');
const importFileInput = $('#importFileInput');
const importExportStatus = $('#importExportStatus');

let pointerDrag = null;

// ============================
//  HILFSFUNKTIONEN
// ============================
function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function getPieceById(id) {
  return PIECES.find(p => p.id === id);
}

function getSideLabel(side) {
  return side === 'white' ? 'Weiß' : 'Schwarz';
}

function formatNumber(num) {
  return num > 0 ? `+${num}` : String(num);
}

function isImageUrl(value) {
  return /^(https?:|data:image\/|blob:|file:)/i.test(value);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getScoreTone(value) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

// ============================
//  LOGO-VERWALTUNG
// ============================
function loadTeamLogos() {
  try {
    const raw = localStorage.getItem('rasenschach.teamLogos');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.white) teamLogos.white = parsed.white;
      if (parsed.black) teamLogos.black = parsed.black;
    }
  } catch { /* ignore */ }
}

function saveTeamLogos() {
  try {
    localStorage.setItem('rasenschach.teamLogos', JSON.stringify({
      white: teamLogos.white,
      black: teamLogos.black,
    }));
  } catch { /* ignore */ }
}

function renderTeamLogos() {
  SIDES.forEach(side => {
    const img = $(`#${side}Logo`);
    const removeBtn = document.querySelector(`.remove-logo-btn[data-team="${side}"]`);
    if (!img) return;
    if (teamLogos[side]) {
      img.src = teamLogos[side];
      img.style.display = 'block';
      if (removeBtn) removeBtn.classList.add('visible');
    } else {
      img.src = '';
      img.style.display = 'none';
      if (removeBtn) removeBtn.classList.remove('visible');
    }
  });
}

function handleLogoUpload(team, file) {
  if (!file) return;
  const process = (dataUrl) => {
    teamLogos[team] = dataUrl;
    saveTeamLogos();
    renderTeamLogos();
    renderTotals();
  };
  if (file.size > 500 * 1024) {
    compressImage(file, process);
  } else {
    const reader = new FileReader();
    reader.onload = () => process(reader.result);
    reader.readAsDataURL(file);
  }
}

function removeTeamLogo(team) {
  teamLogos[team] = null;
  saveTeamLogos();
  renderTeamLogos();
  renderTotals();
}

// ============================
//  BILD-KOMPRIMIERUNG
// ============================
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 200;
      let w = img.width, h = img.height;
      if (w > h) {
        if (w > maxSize) { h = Math.round((h * maxSize) / w); w = maxSize; }
      } else {
        if (h > maxSize) { w = Math.round((w * maxSize) / h); h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================
//  FIGUREN-BILDER (auf dem Feld)
// ============================
function handleFigureImageUpload(file, cell) {
  if (!file) return;
  const process = (dataUrl) => {
    state.figureImages[cell.dataset.figureSlot] = dataUrl;
    const piece = getPieceById(cell.dataset.figureSlot.split('-')[1]);
    renderFigureCell(cell, piece);
  };
  if (file.size > 500 * 1024) {
    compressImage(file, process);
  } else {
    const reader = new FileReader();
    reader.onload = () => process(reader.result);
    reader.readAsDataURL(file);
  }
}

function getDroppedImageUrl(dataTransfer) {
  const uri = dataTransfer.getData('text/uri-list')?.split('\n').find(l => l && !l.startsWith('#'));
  if (uri && isImageUrl(uri)) return uri;
  const plain = dataTransfer.getData('text/plain');
  if (plain && isImageUrl(plain.trim())) return plain.trim();
  const html = dataTransfer.getData('text/html');
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

// ============================
//  PUNKTE-BERECHNUNG
// ============================
function getAssignmentScore(assignment) {
  if (!assignment.side || !assignment.piece || !assignment.polarity) return 0;
  const piece = getPieceById(assignment.piece);
  const sign = assignment.polarity === 'positive' ? 1 : -1;
  switch (assignment.piece) {
    case 'knight':
      return (assignment.polarity === 'positive') ? (state.questionValue ?? assignment.knightSwing) : 0;
    case 'bishop':
      return (assignment.polarity === 'positive') ? -piece.base : 0;
    case 'queen':
      return (assignment.polarity === 'positive') ? piece.base : 0;
    case 'rook':
      return piece.base * sign * -1;
    default: // king
      return piece.base * sign;
  }
}

function getPlayerScore(side, pieceId) {
  return Number(state.results[side]?.[pieceId]) || 0;
}

function getSideTotal(side) {
  let total = 0;
  PIECES.forEach(p => total += getPlayerScore(side, p.id));
  state.assignments.forEach(a => {
    if (a.side === side) total += getAssignmentScore(a);
  });
  return total;
}

function calculateTotals() {
  return { white: getSideTotal('white'), black: getSideTotal('black') };
}

// ============================
//  RENDER-FUNKTIONEN
// ============================
function renderFigureCell(cell, piece) {
  const slot = cell.dataset.figureSlot;
  const image = state.figureImages[slot];
  const side = cell.dataset.side;
  const score = getPlayerScore(side, piece.id);
  const scoreMarkup = `<strong class="field-watermark ${getScoreTone(score)}">${formatNumber(score)}</strong>`;
  const pieceSvg = PIECE_SVG_URLS[piece.id];
  const pieceImgMarkup = pieceSvg ? `<img class="piece-svg${image ? ' piece-corner' : ''}" src="${pieceSvg}" alt="" />` : '';

  if (image && isImageUrl(image)) {
    cell.classList.add('has-player-image');
    cell.innerHTML = `
      ${scoreMarkup}
      <img class="player-photo" src="${image}" alt="" />
      ${pieceImgMarkup}
      <button class="remove-player-photo" type="button" aria-label="Bild entfernen">×</button>
    `;
    cell.querySelector('.player-photo').addEventListener('error', () => {
      delete state.figureImages[slot];
      renderFigureCell(cell, piece);
    });
    cell.querySelector('.remove-player-photo').addEventListener('click', (e) => {
      e.stopPropagation();
      delete state.figureImages[slot];
      renderFigureCell(cell, piece);
    });
  } else {
    if (image) delete state.figureImages[slot];
    cell.classList.remove('has-player-image');
    cell.innerHTML = `${scoreMarkup}${pieceImgMarkup}`;
  }

  const icon = cell.querySelector('.piece-svg');
  if (icon) icon.addEventListener('error', () => icon.remove());
}

function createBoard() {
  pieceGrid.innerHTML = '';
  const rows = ['top', 'white', 'black', 'bottom'];
  rows.forEach(row => {
    PIECES.forEach((piece, idx) => {
      const cell = document.createElement('article');
      cell.className = 'grid-cell';
      if (row === 'top' || row === 'bottom') {
        cell.classList.add('piece-cell');
        cell.dataset.figureSlot = `${row}-${piece.id}`;
        cell.dataset.side = row === 'top' ? 'white' : 'black';
        cell.dataset.piece = piece.id;
        if ((row === 'top' && idx % 2 === 1) || (row === 'bottom' && idx % 2 === 0)) {
          cell.classList.add('light');
        }
        cell.setAttribute('aria-label', piece.name);
        renderFigureCell(cell, piece);
        cell.addEventListener('dragover', handleFigureDragOver);
        cell.addEventListener('dragleave', handleFigureDragLeave);
        cell.addEventListener('drop', handleFigureDrop);
        cell.addEventListener('dblclick', handleFigurePick);
      } else {
        cell.classList.add('drop-cell');
        cell.dataset.side = row;
        cell.dataset.piece = piece.id;
        const displayVal = (piece.id === 'knight' && state.questionValue !== null)
          ? formatNumber(state.questionValue)
          : piece.value;
        cell.innerHTML = `
          <div class="cell-head">
            <div class="cell-value">${displayVal}</div>
          </div>
          <div class="placed-list" data-slot="${row}-${piece.id}"></div>
        `;
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('drop', handleDrop);
      }
      pieceGrid.appendChild(cell);
    });
  });
}

function renderPlacements() {
  document.querySelectorAll('.placed-list').forEach(slot => slot.innerHTML = '');
  state.assignments.forEach(a => {
    if (!a.side || !a.piece) return;
    const slot = document.querySelector(`[data-slot="${a.side}-${a.piece}"]`);
    if (!slot) return;
    const score = getAssignmentScore(a);
    const chip = document.createElement('span');
    chip.className = `placed-chip ${getScoreTone(score)}`;
    chip.draggable = true;
    chip.dataset.id = a.id;
    chip.innerHTML = `
      <strong class="chip-watermark">${formatNumber(score)}</strong>
      <span class="fit-text">${escapeHtml(state.theses[a.id - 1])}</span>
      <strong class="chip-score">${formatNumber(score)}</strong>
    `;
    chip.title = `${state.theses[a.id - 1]} ${a.polarity || 'unbewertet'} ${formatNumber(score)}`;
    chip.addEventListener('dragstart', handleDragStart);
    chip.addEventListener('pointerdown', handlePointerDragStart);
    slot.appendChild(chip);
  });
}

function createThesisList() {
  thesisList.innerHTML = '';
  state.assignments.forEach(a => {
    if (a.side && a.piece) return;
    const card = document.createElement('article');
    card.className = 'thesis-card';
    card.draggable = true;
    card.dataset.id = a.id;
    card.innerHTML = `<div class="thesis-title fit-text">${escapeHtml(state.theses[a.id - 1])}</div>`;
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('pointerdown', handlePointerDragStart);
    thesisList.appendChild(card);
  });
}

function createEvaluationList() {
  evaluationList.innerHTML = '';
  state.assignments.forEach(a => {
    const card = document.createElement('article');
    card.className = 'evaluation-card';
    const isActive = (val) => a.polarity === val ? 'active' : '';
    card.innerHTML = `
      <strong>These ${a.id}</strong>
      <input aria-label="These ${a.id} Titel" data-id="${a.id}" data-field="thesis-text" value="${escapeHtml(state.theses[a.id - 1])}" />
      <div class="evaluation-controls" aria-label="These ${a.id} auswerten">
        <button class="neutral-button ${!a.polarity ? 'active' : ''}" data-id="${a.id}" data-polarity="" type="button">unausgewertet</button>
        <button class="polarity-button ${a.polarity === 'positive' ? 'active' : ''}" data-id="${a.id}" data-polarity="positive" type="button">+</button>
        <button class="polarity-button ${a.polarity === 'negative' ? 'active' : ''}" data-id="${a.id}" data-polarity="negative" type="button">-</button>
      </div>
    `;
    evaluationList.appendChild(card);
  });
}

function createResultSettings() {
  resultsGrid.innerHTML = '';
  SIDES.forEach(side => {
    const group = document.createElement('section');
    group.className = 'result-group';
    group.innerHTML = `
      <h3>${getSideLabel(side)}</h3>
      ${PIECES.map(p => `
        <div class="result-row">
          <label for="${side}-${p.id}-result">${p.name}</label>
          <input id="${side}-${p.id}-result" data-side="${side}" data-piece="${p.id}" type="number" step="1" value="${state.results[side][p.id]}" />
        </div>
      `).join('')}
    `;
    resultsGrid.appendChild(group);
  });
}

function renderTotals() {
  const totals = calculateTotals();
  $('#whiteTotal').textContent = totals.white;
  $('#blackTotal').textContent = totals.black;
  SIDES.forEach(side => {
    const label = nameInputs[side].value.trim() || getSideLabel(side);
    $(`#${side}Label`).textContent = label;
  });
}

function renderRandomizerState() {
  questionValueLabel.textContent = state.questionValue === null
    ? 'noch nicht gewürfelt'
    : formatNumber(state.questionValue);
}

// ---- NEUE TICKER-FUNKTIONEN ----
function renderPiecePoints() {
  const container = document.getElementById('piecePointsDisplay');
  if (!container) return;
  let html = '';
  SIDES.forEach(side => {
    const label = side === 'white' ? '⚪' : '⚫';
    const points = PIECES.map(p => {
      const val = getPlayerScore(side, p.id);
      const cls = getScoreTone(val);
      const icon = p.id === 'rook' ? '♜' :
                   p.id === 'bishop' ? '♝' :
                   p.id === 'knight' ? '♞' :
                   p.id === 'queen' ? '♛' : '♚';
      return `<span class="piece-tag"><span class="icon">${icon}</span><span class="value ${cls}">${formatNumber(val)}</span></span>`;
    }).join('');
    html += `<span style="display:contents;"><span style="font-weight:700;margin-right:4px;">${label}</span>${points}</span>`;
  });
  container.innerHTML = html;
}

function renderThesisStatus() {
  const container = document.getElementById('thesisStatusDisplay');
  if (!container) return;
  const placed = state.assignments.filter(a => a.side && a.piece).length;
  const total = state.assignments.length;
  const evaluated = state.assignments.filter(a => a.polarity).length;
  container.innerHTML = `
    <span>📋 <strong>${placed}</strong> von <strong>${total}</strong> platziert</span>
    <span>•</span>
    <span>🔍 <strong>${evaluated}</strong> bewertet</span>
  `;
}

function renderRandomizerStatus() {
  const container = document.getElementById('randomizerStatusDisplay');
  if (!container) return;
  const val = state.questionValue;
  const text = val !== null ? formatNumber(val) : '❓ noch nicht gewürfelt';
  const cls = val !== null ? getScoreTone(val) : 'neutral';
  container.innerHTML = `<span class="value ${cls}">🎲 ${text}</span>`;
}

// ---- Haupt-Render ----
function render() {
  createBoard();
  createThesisList();
  createEvaluationList();
  renderPlacements();
  renderTotals();
  renderRandomizerState();
  renderTeamLogos();
  // Neue Ticker
  renderPiecePoints();
  renderThesisStatus();
  renderRandomizerStatus();
  fitAllCardText();
}

function fitAllCardText() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.thesis-card .fit-text, .placed-chip .fit-text').forEach(el => {
      const container = el.closest('.thesis-card, .placed-chip');
      if (!container) return;
      let size = el.closest('.placed-chip') ? 11 : 16;
      const minSize = el.closest('.placed-chip') ? 6 : 8;
      el.style.fontSize = size + 'px';
      while (size > minSize &&
        (el.scrollHeight > container.clientHeight - 4 || el.scrollWidth > el.clientWidth)) {
        size--;
        el.style.fontSize = size + 'px';
      }
    });
  });
}

// ============================
//  DRAG & DROP (Maus)
// ============================
function handleDragStart(e) {
  const id = e.currentTarget.dataset.id;
  e.dataTransfer.setData('text/plain', id);
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  const id = Number(e.dataTransfer.getData('text/plain'));
  const assignment = state.assignments.find(a => a.id === id);
  const cell = e.currentTarget;
  cell.classList.remove('drag-over');
  if (!assignment) return;
  assignment.side = cell.dataset.side;
  assignment.piece = cell.dataset.piece;
  render();
}

// ============================
//  DRAG & DROP (Touch / Stift)
// ============================
function handlePointerDragStart(e) {
  if (e.target.closest('button')) return;
  const id = Number(e.currentTarget.dataset.id);
  if (!id) return;
  e.preventDefault();
  pointerDrag = {
    id,
    ghost: document.createElement('div'),
  };
  pointerDrag.ghost.className = 'drag-ghost';
  pointerDrag.ghost.textContent = state.theses[id - 1];
  document.body.appendChild(pointerDrag.ghost);
  movePointerGhost(e.clientX, e.clientY);
  window.addEventListener('pointermove', handlePointerDragMove);
  window.addEventListener('pointerup', handlePointerDragEnd, { once: true });
}

function handlePointerDragMove(e) {
  if (!pointerDrag) return;
  movePointerGhost(e.clientX, e.clientY);
  document.querySelectorAll('.drop-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.drop-cell');
  if (target) target.classList.add('drag-over');
}

function handlePointerDragEnd(e) {
  if (!pointerDrag) return;
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.drop-cell');
  const assignment = state.assignments.find(a => a.id === pointerDrag.id);
  if (target && assignment) {
    assignment.side = target.dataset.side;
    assignment.piece = target.dataset.piece;
  }
  pointerDrag.ghost.remove();
  pointerDrag = null;
  window.removeEventListener('pointermove', handlePointerDragMove);
  document.querySelectorAll('.drop-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
  render();
}

function movePointerGhost(x, y) {
  pointerDrag.ghost.style.left = x + 'px';
  pointerDrag.ghost.style.top = y + 'px';
}

// ============================
//  FIGUREN-BILDER DRAG & DROP
// ============================
function handleFigureDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  e.currentTarget.classList.add('image-drop-over');
}
function handleFigureDragLeave(e) {
  e.currentTarget.classList.remove('image-drop-over');
}
function handleFigureDrop(e) {
  e.preventDefault();
  const cell = e.currentTarget;
  cell.classList.remove('image-drop-over');
  const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
  if (file) {
    handleFigureImageUpload(file, cell);
    return;
  }
  const url = getDroppedImageUrl(e.dataTransfer);
  if (url) {
    state.figureImages[cell.dataset.figureSlot] = url;
    const piece = getPieceById(cell.dataset.figureSlot.split('-')[1]);
    renderFigureCell(cell, piece);
  }
}

function handleFigurePick(e) {
  const cell = e.currentTarget;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    if (input.files?.[0]) handleFigureImageUpload(input.files[0], cell);
  };
  input.click();
}

// ============================
//  EXPORT / IMPORT
// ============================
function getFullExportPayload() {
  return {
    app: 'rasenschach',
    version: 3,
    exportedAt: new Date().toISOString(),
    data: {
      theses: state.theses,
      positions: state.assignments.map(({ id, side, piece, knightSwing, polarity }) => ({ id, side, piece, knightSwing, polarity })),
      names: { white: nameInputs.white.value, black: nameInputs.black.value },
      results: state.results,
      questionValue: state.questionValue,
      figureImages: state.figureImages,
      teamLogos: teamLogos,
    },
  };
}

function setImportExportStatus(msg) {
  importExportStatus.textContent = msg;
}

function exportAllData() {
  try {
    const payload = getFullExportPayload();
    const json = JSON.stringify(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const link = document.createElement('a');
    link.href = url;
    link.download = `rasenschach-speicherstand-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setImportExportStatus(`Export erstellt (${Math.round(blob.size / 1024)} KB).`);
  } catch (err) {
    setImportExportStatus(`Export fehlgeschlagen: ${err.message}`);
  }
}

function importAllData(file) {
  if (!file) { setImportExportStatus('Keine Datei ausgewählt.'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed?.app !== 'rasenschach') throw new Error('Kein Rasenschach-Speicherstand.');
      const data = parsed.data || {};
      // Thesen
      if (Array.isArray(data.theses)) {
        data.theses.forEach((t, i) => { if (i < state.theses.length) state.theses[i] = t; });
      }
      // Positionen
      if (Array.isArray(data.positions)) {
        data.positions.forEach(p => {
          const a = state.assignments.find(item => item.id === p.id);
          if (!a) return;
          if (p.side === null || SIDES.includes(p.side)) a.side = p.side || null;
          if (p.piece === null || PIECE_IDS.includes(p.piece)) a.piece = p.piece || null;
          if (p.knightSwing === -1 || p.knightSwing === 1) a.knightSwing = p.knightSwing;
          if (p.polarity === null || POLARITIES.includes(p.polarity)) a.polarity = p.polarity || null;
        });
      }
      // Namen
      if (data.names) {
        if (data.names.white) nameInputs.white.value = data.names.white;
        if (data.names.black) nameInputs.black.value = data.names.black;
      }
      // Ergebnisse
      if (data.results) {
        const next = cloneData(initialBonuses);
        SIDES.forEach(side => {
          if (!data.results[side]) return;
          PIECE_IDS.forEach(id => {
            if (id in data.results[side]) {
              const v = Number(data.results[side][id]);
              if (Number.isFinite(v)) next[side][id] = v;
            }
          });
        });
        state.results = next;
      }
      // Randomizer
      if (data.questionValue !== undefined) {
        const val = data.questionValue;
        if (val === null || QUESTION_VALUES.includes(val)) state.questionValue = val ?? null;
      }
      // Figurenbilder
      if (data.figureImages && typeof data.figureImages === 'object') {
        const safe = {};
        Object.entries(data.figureImages).forEach(([slot, url]) => {
          if (isImageUrl(url)) safe[slot] = url;
        });
        state.figureImages = safe;
      }
      // Team-Logos
      if (data.teamLogos) {
        if (isImageUrl(data.teamLogos.white)) teamLogos.white = data.teamLogos.white;
        if (isImageUrl(data.teamLogos.black)) teamLogos.black = data.teamLogos.black;
        saveTeamLogos();
      }
      render();
      createResultSettings();
      renderTeamLogos();
      setImportExportStatus('Import erfolgreich!');
    } catch (err) {
      setImportExportStatus(`Import fehlgeschlagen: ${err.message}`);
    }
  };
  reader.onerror = () => setImportExportStatus('Datei konnte nicht gelesen werden.');
  reader.readAsText(file);
}

// ============================
//  EVENT-LISTENER
// ============================
// Team-Logos
document.addEventListener('DOMContentLoaded', () => {
  loadTeamLogos();
  renderTeamLogos();
});

document.querySelectorAll('.logo-upload-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const team = btn.dataset.team;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => { if (input.files?.[0]) handleLogoUpload(team, input.files[0]); };
    input.click();
  });
});
document.querySelectorAll('.remove-logo-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeTeamLogo(btn.dataset.team);
  });
});

// Evaluation: Polarität setzen
evaluationList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-polarity]');
  if (!btn) return;
  const a = state.assignments.find(item => item.id === Number(btn.dataset.id));
  if (!a) return;
  a.polarity = btn.dataset.polarity || null;
  render();
});

// Evaluation: Thesentext ändern
evaluationList.addEventListener('input', (e) => {
  const inp = e.target;
  if (!inp.matches('[data-field="thesis-text"]')) return;
  const idx = Number(inp.dataset.id) - 1;
  state.theses[idx] = inp.value;
  createThesisList();
  renderPlacements();
  fitAllCardText();
});

// Ergebnisseingaben
resultsGrid.addEventListener('input', (e) => {
  const inp = e.target;
  if (!inp.matches('[data-side][data-piece]')) return;
  const { side, piece } = inp.dataset;
  if (!SIDES.includes(side) || !PIECE_IDS.includes(piece)) return;
  state.results[side][piece] = Number(inp.value) || 0;
  createBoard();
  renderPlacements();
  renderTotals();
  fitAllCardText();
});

// Teamnamen ändern
Object.values(nameInputs).forEach(inp => inp.addEventListener('input', renderTotals));

// Fenster-Resize: Texte anpassen
window.addEventListener('resize', fitAllCardText);

// Settings-Dialog
openSettingsBtn.addEventListener('click', () => settingsDialog.showModal?.() || settingsDialog.setAttribute('open', ''));
closeSettingsBtn.addEventListener('click', () => settingsDialog.close?.() || settingsDialog.removeAttribute('open'));

// Export / Import
exportAllBtn.addEventListener('click', exportAllData);
importAllBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', () => {
  if (importFileInput.files?.[0]) importAllData(importFileInput.files[0]);
  importFileInput.value = '';
});

// Randomizer
randomQuestionBtn.addEventListener('click', () => {
  state.questionValue = QUESTION_VALUES[Math.floor(Math.random() * QUESTION_VALUES.length)];
  render();
});

// ============================
//  INIT
// ============================
render();
createResultSettings();