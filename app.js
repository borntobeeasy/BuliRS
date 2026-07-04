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

const PIECE_SVG_URLS = {
  rook:   'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  bishop: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  knight: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  queen:  'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  king:   'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
};

// ============================
//  ZUSTAND & UNDO-STACK
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

const undoStack = [];
const MAX_UNDO = 20;
let isUndoing = false;

function pushUndo() {
  if (isUndoing) return;
  const snapshot = {
    theses: [...state.theses],
    assignments: state.assignments.map(a => ({ ...a })),
    results: cloneData(state.results),
    figureImages: { ...state.figureImages },
    questionValue: state.questionValue,
    teamLogos: { ...teamLogos },
    teamNames: {
      white: nameInputs.white.value,
      black: nameInputs.black.value,
    }
  };
  undoStack.push(snapshot);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  updateUndoButtonState();
}

function undoLastAction() {
  if (undoStack.length === 0) return;
  isUndoing = true;
  const snapshot = undoStack.pop();
  state.theses = snapshot.theses;
  state.assignments = snapshot.assignments.map(a => ({ ...a }));
  state.results = cloneData(snapshot.results);
  state.figureImages = { ...snapshot.figureImages };
  state.questionValue = snapshot.questionValue;
  teamLogos.white = snapshot.teamLogos.white;
  teamLogos.black = snapshot.teamLogos.black;
  if (snapshot.teamNames) {
    nameInputs.white.value = snapshot.teamNames.white;
    nameInputs.black.value = snapshot.teamNames.black;
  }
  render();
  createResultSettings();
  renderTeamLogos();
  saveTeamLogos();
  isUndoing = false;
  updateUndoButtonState();
}

function updateUndoButtonState() {
  const btn = document.getElementById('undoButton');
  if (btn) {
    btn.style.opacity = undoStack.length > 0 ? '1' : '0.4';
    btn.style.cursor = undoStack.length > 0 ? 'pointer' : 'default';
    btn.disabled = undoStack.length === 0;
  }
}

// ============================
//  DOM-REFERENZEN
// ============================
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
const toggleThesisBtn = $('#toggleThesisButton');
const toggleRemoveBtn = $('#toggleRemoveButtons');
const appShell = document.querySelector('.app-shell');
const thesisPanel = $('#thesisPanel');
const fieldThesisWrapper = $('#fieldThesisWrapper');
const undoBtn = $('#undoButton');

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

function getScoreTone(value, evaluated) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  if (value === 0 && evaluated) return 'zero';
  return 'neutral';
}

function isEvaluationActive() {
  return state.assignments.some(a => a.polarity);
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
    const wrapper = document.querySelector(`.team-logo-wrapper[data-team="${side}"]`);
    const removeBtn = document.querySelector(`.remove-logo-btn[data-team="${side}"]`);
    if (!img) return;
    if (teamLogos[side]) {
      img.src = teamLogos[side];
      img.style.display = 'block';
      if (removeBtn) removeBtn.classList.add('visible');
      if (wrapper) wrapper.classList.add('has-logo');
    } else {
      img.src = '';
      img.style.display = 'none';
      if (removeBtn) removeBtn.classList.remove('visible');
      if (wrapper) wrapper.classList.remove('has-logo');
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
    pushUndo();
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
  pushUndo();
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
//  FIGUREN-BILDER
// ============================
function handleFigureImageUpload(file, cell) {
  if (!file) return;
  const process = (dataUrl) => {
    state.figureImages[cell.dataset.figureSlot] = dataUrl;
    const piece = getPieceById(cell.dataset.figureSlot.split('-')[1]);
    renderFigureCell(cell, piece);
    pushUndo();
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
    default:
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
  const scoreMarkup = `<strong class="field-watermark ${getScoreTone(score, isEvaluationActive())}">${formatNumber(score)}</strong>`;
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
      pushUndo();
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
        cell.addEventListener('click', handleFigurePick);
      } else {
        cell.classList.add('drop-cell');
        cell.dataset.side = row;
        cell.dataset.piece = piece.id;

        // Thesen-Summe auf diesem Feld berechnen
        let thesisTotal = 0;
        state.assignments.forEach(a => {
          if (a.side === row && a.piece === piece.id) {
            thesisTotal += getAssignmentScore(a);
          }
        });

        // Figurenwert (fest) – je nach Springer-Sonderfall
        let figureValue = (piece.id === 'knight' && state.questionValue !== null)
          ? formatNumber(state.questionValue)
          : piece.value;

        let html = `<div class="drop-value">${figureValue}</div>`;

        if (thesisTotal !== 0) {
          html += `<div class="drop-total">${formatNumber(thesisTotal)}</div>`;
          cell.classList.add('has-theses');
        }

        html += `<div class="placed-list" data-slot="${row}-${piece.id}"></div>`;

        cell.innerHTML = html;

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
    const piece = getPieceById(a.piece);
    const fieldLabel = (a.piece === 'knight' && state.questionValue !== null)
      ? formatNumber(state.questionValue)
      : piece.value;
    const score = getAssignmentScore(a);
    const chip = document.createElement('span');
    chip.className = `placed-chip`;
    chip.draggable = true;
    chip.dataset.id = a.id;
    chip.innerHTML = `
      <span class="chip-field-badge">${escapeHtml(fieldLabel)}</span>
      <strong class="chip-watermark ${getScoreTone(score, Boolean(a.polarity))}">${formatNumber(score)}</strong>
      <span class="fit-text">${escapeHtml(state.theses[a.id - 1])}</span>
    `;
    chip.title = `${state.theses[a.id - 1]} — Feld ${fieldLabel} — ${formatNumber(score)} Punkte`;
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
    const neutralActive = !a.polarity ? 'active' : '';
    const positiveActive = a.polarity === 'positive' ? 'active' : '';
    const negativeActive = a.polarity === 'negative' ? 'active' : '';
    card.innerHTML = `
      <strong>These ${a.id}</strong>
      <input aria-label="These ${a.id} Titel" data-id="${a.id}" data-field="thesis-text" value="${escapeHtml(state.theses[a.id - 1])}" />
      <div class="evaluation-controls" aria-label="These ${a.id} auswerten">
        <button class="neutral-button ${neutralActive}" data-id="${a.id}" data-polarity="" type="button">unausgewertet</button>
        <button class="polarity-button ${positiveActive}" data-id="${a.id}" data-polarity="positive" type="button">+</button>
        <button class="polarity-button ${negativeActive}" data-id="${a.id}" data-polarity="negative" type="button">-</button>
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

function renderThesisStatus() {
  const container = document.getElementById('thesisStatusDisplay');
  if (!container) return;
  const placed = state.assignments.filter(a => a.side && a.piece).length;
  const total = 10;
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

function render() {
  createBoard();
  createThesisList();
  createEvaluationList();
  renderPlacements();
  renderTotals();
  renderRandomizerState();
  renderTeamLogos();
  renderThesisStatus();
  renderRandomizerStatus();
  fitAllCardText();
  updateUndoButtonState();
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
//  DRAG & DROP (Maus + Touch)
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
  const oldSide = assignment.side;
  const oldPiece = assignment.piece;
  assignment.side = cell.dataset.side;
  assignment.piece = cell.dataset.piece;
  render();
  if (oldSide !== assignment.side || oldPiece !== assignment.piece) pushUndo();
}

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
  let changed = false;
  if (target && assignment) {
    const oldSide = assignment.side;
    const oldPiece = assignment.piece;
    assignment.side = target.dataset.side;
    assignment.piece = target.dataset.piece;
    if (oldSide !== assignment.side || oldPiece !== assignment.piece) changed = true;
  }
  pointerDrag.ghost.remove();
  pointerDrag = null;
  window.removeEventListener('pointermove', handlePointerDragMove);
  document.querySelectorAll('.drop-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
  render();
  if (changed) pushUndo();
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
    pushUndo();
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
//  LOGO DRAG & DROP
// ============================
document.querySelectorAll('.team-logo-wrapper').forEach(wrapper => {
  wrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    wrapper.classList.add('drag-over');
  });
  wrapper.addEventListener('dragleave', (e) => {
    wrapper.classList.remove('drag-over');
  });
  wrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    wrapper.classList.remove('drag-over');
    const team = wrapper.dataset.team;
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    if (file) {
      handleLogoUpload(team, file);
    } else {
      const url = getDroppedImageUrl(e.dataTransfer);
      if (url) {
        teamLogos[team] = url;
        saveTeamLogos();
        renderTeamLogos();
        renderTotals();
        pushUndo();
      }
    }
  });
});

// ============================
//  TOGGLES
// ============================
toggleRemoveBtn?.addEventListener('click', () => {
  const isActive = appShell.classList.toggle('show-remove-buttons');
  toggleRemoveBtn.setAttribute('aria-pressed', String(isActive));
  toggleRemoveBtn.textContent = isActive ? '× ausblenden' : '× anzeigen';
});

toggleThesisBtn.addEventListener('click', () => {
  const isHidden = thesisPanel.hasAttribute('hidden');
  if (isHidden) {
    thesisPanel.removeAttribute('hidden');
    toggleThesisBtn.textContent = 'Thesen ausblenden';
    fieldThesisWrapper.classList.remove('thesis-hidden');
  } else {
    thesisPanel.setAttribute('hidden', '');
    toggleThesisBtn.textContent = 'Thesen einblenden';
    fieldThesisWrapper.classList.add('thesis-hidden');
  }
  if (!isHidden) fitAllCardText();
});

// ============================
//  UNDO
// ============================
undoBtn?.addEventListener('click', undoLastAction);

// ============================
//  EXPORT / IMPORT (JSON)
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
      if (Array.isArray(data.theses)) {
        data.theses.forEach((t, i) => { if (i < state.theses.length) state.theses[i] = t; });
      }
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
      if (data.names) {
        if (data.names.white) nameInputs.white.value = data.names.white;
        if (data.names.black) nameInputs.black.value = data.names.black;
      }
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
      if (data.questionValue !== undefined) {
        const val = data.questionValue;
        if (val === null || QUESTION_VALUES.includes(val)) state.questionValue = val ?? null;
      }
      if (data.figureImages && typeof data.figureImages === 'object') {
        const safe = {};
        Object.entries(data.figureImages).forEach(([slot, url]) => {
          if (isImageUrl(url)) safe[slot] = url;
        });
        state.figureImages = safe;
      }
      if (data.teamLogos) {
        if (isImageUrl(data.teamLogos.white)) teamLogos.white = data.teamLogos.white;
        if (isImageUrl(data.teamLogos.black)) teamLogos.black = data.teamLogos.black;
        saveTeamLogos();
      }
      render();
      createResultSettings();
      renderTeamLogos();
      undoStack.length = 0;
      pushUndo();
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

evaluationList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-polarity]');
  if (!btn) return;
  const a = state.assignments.find(item => item.id === Number(btn.dataset.id));
  if (!a) return;
  const oldPolarity = a.polarity;
  a.polarity = btn.dataset.polarity || null;
  render();
  if (oldPolarity !== a.polarity) pushUndo();
});

evaluationList.addEventListener('input', (e) => {
  const inp = e.target;
  if (!inp.matches('[data-field="thesis-text"]')) return;
  const idx = Number(inp.dataset.id) - 1;
  const oldText = state.theses[idx];
  state.theses[idx] = inp.value;
  createThesisList();
  renderPlacements();
  fitAllCardText();
  if (oldText !== state.theses[idx]) pushUndo();
});

resultsGrid.addEventListener('input', (e) => {
  const inp = e.target;
  if (!inp.matches('[data-side][data-piece]')) return;
  const { side, piece } = inp.dataset;
  if (!SIDES.includes(side) || !PIECE_IDS.includes(piece)) return;
  const oldVal = state.results[side][piece];
  state.results[side][piece] = Number(inp.value) || 0;
  createBoard();
  renderPlacements();
  renderTotals();
  fitAllCardText();
  if (oldVal !== state.results[side][piece]) pushUndo();
});

Object.values(nameInputs).forEach(inp => inp.addEventListener('input', () => {
  renderTotals();
  pushUndo();
}));

window.addEventListener('resize', fitAllCardText);

openSettingsBtn.addEventListener('click', () => settingsDialog.showModal?.() || settingsDialog.setAttribute('open', ''));
closeSettingsBtn.addEventListener('click', () => settingsDialog.close?.() || settingsDialog.removeAttribute('open'));

exportAllBtn.addEventListener('click', exportAllData);
importAllBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', () => {
  if (importFileInput.files?.[0]) importAllData(importFileInput.files[0]);
  importFileInput.value = '';
});

randomQuestionBtn.addEventListener('click', () => {
  const oldVal = state.questionValue;
  state.questionValue = QUESTION_VALUES[Math.floor(Math.random() * QUESTION_VALUES.length)];
  render();
  if (oldVal !== state.questionValue) pushUndo();
});

// ============================
//  INIT
// ============================
render();
createResultSettings();
pushUndo();