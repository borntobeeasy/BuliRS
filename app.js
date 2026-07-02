const pieces = [
  { id: "rook", name: "Turm", value: "-/+3", base: 3 },
  { id: "bishop", name: "Läufer", value: "-1", base: 1 },
  { id: "knight", name: "Springer", value: "?", base: 1 },
  { id: "queen", name: "Dame", value: "+1", base: 1 },
  { id: "king", name: "König", value: "+/-3", base: 3 },
];

const KNOWN_PIECE_IDS = pieces.map((piece) => piece.id);
const KNOWN_SIDES = ["white", "black"];
const KNOWN_POLARITIES = ["positive", "negative"];
const KNOWN_QUESTION_VALUES = [-3, -2, -1, 1, 2, 3];

// Team logos state
const teamLogos = {
  white: null,
  black: null,
};

// Load logos from localStorage
function loadTeamLogos() {
  try {
    const saved = localStorage.getItem('rasenschach.teamLogos');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.white) teamLogos.white = parsed.white;
      if (parsed.black) teamLogos.black = parsed.black;
    }
  } catch {
    // Ignore
  }
}

// Save logos to localStorage
function saveTeamLogos() {
  try {
    localStorage.setItem('rasenschach.teamLogos', JSON.stringify({
      white: teamLogos.white,
      black: teamLogos.black,
    }));
  } catch {
    // Ignore
  }
}

// Render team logos
function renderTeamLogos() {
  ['white', 'black'].forEach((team) => {
    const img = document.getElementById(`${team}Logo`);
    const removeBtn = document.querySelector(`.remove-logo-btn[data-team="${team}"]`);
    
    if (img) {
      if (teamLogos[team]) {
        img.src = teamLogos[team];
        img.style.display = 'block';
        if (removeBtn) removeBtn.classList.add('visible');
      } else {
        img.src = '';
        img.style.display = 'none';
        if (removeBtn) removeBtn.classList.remove('visible');
      }
    }
  });
}

// Handle logo upload
function handleLogoUpload(team, file) {
  if (!file) return;

  if (file.size > 500 * 1024) {
    compressImage(file, (compressed) => {
      teamLogos[team] = compressed;
      saveTeamLogos();
      renderTeamLogos();
      renderTotals();
    });
    return;
  }

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    teamLogos[team] = reader.result;
    saveTeamLogos();
    renderTeamLogos();
    renderTotals();
  });
  reader.readAsDataURL(file);
}

// Remove logo
function removeTeamLogo(team) {
  teamLogos[team] = null;
  saveTeamLogos();
  renderTeamLogos();
  renderTotals();
}

// Wikimedia Commons Cburnett chess piece SVGs (free/open licensed).
const PIECE_IMAGE_URLS = {
  rook: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
  bishop: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
  knight: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
  queen: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
  king: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
};

function getPieceImageUrl(pieceId) {
  return PIECE_IMAGE_URLS[pieceId] || "";
}

function cloneData(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through to JSON clone
    }
  }
  return JSON.parse(JSON.stringify(value));
}

const theses = Array.from({ length: 12 }, (_, index) => `These ${index + 1}`);

const initialBonuses = {
  white: { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 },
  black: { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 },
};

const state = {
  assignments: theses.map((_, index) => ({
    id: index + 1,
    side: null,
    piece: null,
    polarity: null,
    knightSwing: Math.random() > 0.5 ? 1 : -1,
  })),
  results: cloneData(initialBonuses),
  figureImages: {},
  questionValue: null,
};

const pieceGrid = document.querySelector("#pieceGrid");
const thesisList = document.querySelector("#thesisList");
const evaluationList = document.querySelector("#evaluationList");
const resultsGrid = document.querySelector("#resultsGrid");
const openSettingsButton = document.querySelector("#openSettingsButton");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const settingsDialog = document.querySelector("#settingsDialog");
const randomQuestionButton = document.querySelector("#randomQuestionButton");
const questionValueLabel = document.querySelector("#questionValueLabel");
const exportAllButton = document.querySelector("#exportAllButton");
const importAllButton = document.querySelector("#importAllButton");
const importFileInput = document.querySelector("#importFileInput");
const importExportStatus = document.querySelector("#importExportStatus");
const nameInputs = {
  white: document.querySelector("#whiteName"),
  black: document.querySelector("#blackName"),
};
let pointerDrag = null;

function createBoard() {
  pieceGrid.innerHTML = "";

  ["top", "white", "black", "bottom"].forEach((row) => {
    pieces.forEach((piece, index) => {
      const cell = document.createElement("article");
      cell.className = "grid-cell";

      if (row === "top" || row === "bottom") {
        cell.classList.add("piece-cell");
        cell.dataset.figureSlot = `${row}-${piece.id}`;
        cell.dataset.side = getFigureSide(row);
        cell.dataset.piece = piece.id;
        if ((row === "top" && index % 2 === 1) || (row === "bottom" && index % 2 === 0)) {
          cell.classList.add("light");
        }
        cell.setAttribute("aria-label", piece.name);
        renderFigureCell(cell, piece);
        cell.addEventListener("dragover", handleFigureDragOver);
        cell.addEventListener("dragleave", handleFigureDragLeave);
        cell.addEventListener("drop", handleFigureDrop);
        cell.addEventListener("dblclick", handleFigurePick);
      } else {
        cell.classList.add("drop-cell");
        cell.dataset.side = row;
        cell.dataset.piece = piece.id;
        cell.innerHTML = `
          <div class="cell-head">
            <div class="cell-value">${getDisplayValue(piece)}</div>
          </div>
          <div class="placed-list" data-slot="${row}-${piece.id}"></div>
        `;
        cell.addEventListener("dragover", handleDragOver);
        cell.addEventListener("dragleave", handleDragLeave);
        cell.addEventListener("drop", handleDrop);
      }

      pieceGrid.appendChild(cell);
    });
  });
}

function renderFigureCell(cell, piece) {
  const image = state.figureImages[cell.dataset.figureSlot];
  const score = getPlayerScore(cell.dataset.side, piece.id);
  const scoreMarkup = `<strong class="field-watermark ${getScoreTone(score)}">${getSignedNumber(score)}</strong>`;
  const pieceImageUrl = getPieceImageUrl(piece.id);
  const pieceImageMarkup = pieceImageUrl
    ? `<img class="piece-svg${image ? " piece-corner" : ""}" src="${pieceImageUrl}" alt="" />`
    : "";

  if (image && isImageLikeUrl(image)) {
    cell.classList.add("has-player-image");
    cell.innerHTML = `
      ${scoreMarkup}
      <img class="player-photo" src="${image}" alt="" />
      ${pieceImageMarkup}
      <button class="remove-player-photo" type="button" aria-label="Bild entfernen">×</button>
    `;
    const photo = cell.querySelector(".player-photo");
    photo.addEventListener("error", () => {
      delete state.figureImages[cell.dataset.figureSlot];
      renderFigureCell(cell, piece);
    });
    cell.querySelector(".remove-player-photo").addEventListener("click", (event) => {
      event.stopPropagation();
      delete state.figureImages[cell.dataset.figureSlot];
      renderFigureCell(cell, piece);
    });
  } else {
    if (image) {
      delete state.figureImages[cell.dataset.figureSlot];
    }
    cell.classList.remove("has-player-image");
    cell.innerHTML = `
      ${scoreMarkup}
      ${pieceImageMarkup}
    `;
  }

  const pieceIcon = cell.querySelector(".piece-svg");
  if (pieceIcon) {
    pieceIcon.addEventListener("error", () => {
      pieceIcon.remove();
    });
  }
}

function getFigureSide(row) {
  return row === "top" ? "white" : "black";
}

function getDisplayValue(piece) {
  if (piece.id === "knight" && state.questionValue !== null) {
    return state.questionValue > 0 ? `+${state.questionValue}` : String(state.questionValue);
  }

  return piece.value;
}

function handleFigurePick(event) {
  const cell = event.currentTarget;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) {
      readPlayerImageFile(file, cell);
    }
  });
  input.click();
}

function handleFigureDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  event.currentTarget.classList.add("image-drop-over");
}

function handleFigureDragLeave(event) {
  event.currentTarget.classList.remove("image-drop-over");
}

function handleFigureDrop(event) {
  event.preventDefault();
  const cell = event.currentTarget;
  cell.classList.remove("image-drop-over");

  const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
  if (file) {
    readPlayerImageFile(file, cell);
    return;
  }

  const url = getDroppedImageUrl(event.dataTransfer);
  if (url) {
    state.figureImages[cell.dataset.figureSlot] = url;
    const piece = pieces.find((item) => cell.dataset.figureSlot.endsWith(item.id));
    renderFigureCell(cell, piece);
  }
}

function readPlayerImageFile(file, cell) {
  if (!file) return;

  if (file.size > 500 * 1024) {
    compressImage(file, (compressed) => {
      state.figureImages[cell.dataset.figureSlot] = compressed;
      const piece = pieces.find((item) => cell.dataset.figureSlot.endsWith(item.id));
      renderFigureCell(cell, piece);
    });
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.figureImages[cell.dataset.figureSlot] = reader.result;
    const piece = pieces.find((item) => cell.dataset.figureSlot.endsWith(item.id));
    renderFigureCell(cell, piece);
  });
  reader.readAsDataURL(file);
}

function compressImage(file, callback) {
  const reader = new FileReader();
  reader.addEventListener("load", (e) => {
    const img = new Image();
    img.addEventListener("load", () => {
      const canvas = document.createElement("canvas");
      const maxSize = 200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", 0.7));
    });
    img.src = e.target.result;
  });
  reader.readAsDataURL(file);
}

function getDroppedImageUrl(dataTransfer) {
  const uri = dataTransfer.getData("text/uri-list")?.split("\n").find((line) => line && !line.startsWith("#"));
  if (uri && isImageLikeUrl(uri)) return uri;

  const plainText = dataTransfer.getData("text/plain");
  if (plainText && isImageLikeUrl(plainText.trim())) return plainText.trim();

  const html = dataTransfer.getData("text/html");
  if (!html) return "";

  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || "";
}

function isImageLikeUrl(value) {
  return /^(https?:|data:image\/|blob:|file:)/i.test(value);
}

function getSectionPayload() {
  return {
    theses: [...theses],
    positions: state.assignments.map(({ id, side, piece, knightSwing, polarity }) => ({
      id,
      side,
      piece,
      knightSwing,
      polarity,
    })),
    names: {
      white: nameInputs.white.value,
      black: nameInputs.black.value,
    },
    results: state.results,
    questionValue: state.questionValue,
    figureImages: state.figureImages,
    teamLogos: teamLogos,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFullExportPayload() {
  return {
    app: "rasenschach",
    version: 3,
    exportedAt: new Date().toISOString(),
    data: getSectionPayload(),
  };
}

function exportAllData() {
  try {
    let totalSize = 0;
    Object.values(state.figureImages).forEach((url) => {
      if (url.startsWith("data:image")) {
        const size = Math.round((url.length * 3) / 4);
        totalSize += size;
      }
    });
    Object.values(teamLogos).forEach((url) => {
      if (url && url.startsWith("data:image")) {
        const size = Math.round((url.length * 3) / 4);
        totalSize += size;
      }
    });

    if (totalSize > 4 * 1024 * 1024) {
      if (!confirm(
        `Die Bilder im Spielstand sind sehr groß (ca. ${Math.round(totalSize / 1024 / 1024)} MB). ` +
        `Der Export kann dadurch lange dauern und die Datei sehr groß werden. ` +
        `Möchten Sie trotzdem fortfahren?`
      )) {
        setImportExportStatus("Export abgebrochen.");
        return;
      }
    }

    const payload = getFullExportPayload();
    const json = JSON.stringify(payload);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    const link = document.createElement("a");
    link.href = url;
    link.download = `rasenschach-speicherstand-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    const size = Math.round(blob.size / 1024);
    setImportExportStatus(`Export erstellt (${size} KB).`);
  } catch (error) {
    setImportExportStatus(`Export fehlgeschlagen: ${error.message}`);
  }
}

function importAllData(file) {
  if (!file) {
    setImportExportStatus("Keine Datei ausgewählt.");
    return;
  }

  const reader = new FileReader();

  reader.addEventListener("load", () => {
    let parsed;
    try {
      parsed = JSON.parse(String(reader.result));
    } catch {
      setImportExportStatus("Datei konnte nicht gelesen werden (kein gültiges JSON).");
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      setImportExportStatus("Datei hat kein gültiges Format.");
      return;
    }

    if (parsed.app !== "rasenschach") {
      setImportExportStatus("Datei ist kein Rasenschach-Speicherstand.");
      return;
    }

    const data = parsed.data;
    if (!data || typeof data !== "object") {
      setImportExportStatus("Datei enthält keine gültigen Daten.");
      return;
    }

    try {
      if (Array.isArray(data.theses)) {
        data.theses.forEach((value, index) => {
          if (typeof value === "string" && index >= 0 && index < theses.length) {
            theses[index] = value;
          }
        });
      }

      if (Array.isArray(data.positions)) {
        data.positions.forEach((entry) => {
          if (!entry || typeof entry !== "object") return;
          const { id, side, piece, knightSwing, polarity } = entry;
          const assignment = state.assignments.find((item) => item.id === id);
          if (!assignment) return;

          if (side === null || KNOWN_SIDES.includes(side)) assignment.side = side || null;
          if (piece === null || KNOWN_PIECE_IDS.includes(piece)) assignment.piece = piece || null;
          if (knightSwing === -1 || knightSwing === 1) assignment.knightSwing = knightSwing;
          if (polarity === null || KNOWN_POLARITIES.includes(polarity)) assignment.polarity = polarity || null;
        });
      }

      if (data.names && typeof data.names === "object") {
        if (typeof data.names.white === "string" && data.names.white.trim()) {
          nameInputs.white.value = data.names.white;
        }
        if (typeof data.names.black === "string" && data.names.black.trim()) {
          nameInputs.black.value = data.names.black;
        }
      }

      if (data.results && typeof data.results === "object") {
        const nextResults = cloneData(initialBonuses);
        KNOWN_SIDES.forEach((side) => {
          if (!data.results[side] || typeof data.results[side] !== "object") return;
          KNOWN_PIECE_IDS.forEach((pieceId) => {
            if (pieceId in data.results[side]) {
              const value = Number(data.results[side][pieceId]);
              if (Number.isFinite(value)) {
                nextResults[side][pieceId] = value;
              }
            }
          });
        });
        state.results = nextResults;
      }

      if (data.questionValue !== undefined) {
        if (data.questionValue === null || KNOWN_QUESTION_VALUES.includes(data.questionValue)) {
          state.questionValue = data.questionValue ?? null;
        }
      }

      if (data.figureImages && typeof data.figureImages === "object") {
        const safeImages = {};
        Object.entries(data.figureImages).forEach(([slot, url]) => {
          if (typeof url === "string" && isImageLikeUrl(url)) {
            safeImages[slot] = url;
          }
        });
        state.figureImages = safeImages;
      }

      if (data.teamLogos && typeof data.teamLogos === "object") {
        if (data.teamLogos.white && isImageLikeUrl(data.teamLogos.white)) {
          teamLogos.white = data.teamLogos.white;
        }
        if (data.teamLogos.black && isImageLikeUrl(data.teamLogos.black)) {
          teamLogos.black = data.teamLogos.black;
        }
        saveTeamLogos();
      }

      render();
      createResultSettings();
      renderTeamLogos();
      setImportExportStatus("Import erfolgreich! Alle Daten wurden geladen.");
    } catch (error) {
      setImportExportStatus(`Import fehlgeschlagen: ${error.message}`);
    }
  });

  reader.addEventListener("error", () => {
    setImportExportStatus("Datei konnte nicht gelesen werden.");
  });

  reader.readAsText(file);
}

function createThesisList() {
  thesisList.innerHTML = "";

  theses.forEach((_, index) => {
    const assignment = state.assignments[index];
    if (assignment.side && assignment.piece) return;

    const card = document.createElement("article");
    card.className = "thesis-card";
    card.draggable = true;
    card.dataset.id = assignment.id;
    card.innerHTML = `
      <div class="thesis-title">
        <span class="fit-text">${escapeHtml(theses[assignment.id - 1])}</span>
      </div>
    `;

    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("pointerdown", handlePointerDragStart);
    thesisList.appendChild(card);
  });
}

function createEvaluationList() {
  evaluationList.innerHTML = "";

  state.assignments.forEach((assignment) => {
    const card = document.createElement("article");
    card.className = "evaluation-card";
    card.innerHTML = `
      <strong>These ${assignment.id}</strong>
      <input aria-label="These ${assignment.id} Titel" data-id="${assignment.id}" data-field="thesis-text" value="${escapeHtml(theses[assignment.id - 1])}" />
      <div class="evaluation-controls" aria-label="These ${assignment.id} auswerten">
        <button class="neutral-button ${!assignment.polarity ? "active" : ""}" data-id="${assignment.id}" data-polarity="" type="button">unausgewertet</button>
        <button class="polarity-button ${assignment.polarity === "positive" ? "active" : ""}" data-id="${assignment.id}" data-polarity="positive" type="button">+</button>
        <button class="polarity-button ${assignment.polarity === "negative" ? "active" : ""}" data-id="${assignment.id}" data-polarity="negative" type="button">-</button>
      </div>
    `;
    evaluationList.appendChild(card);
  });
}

function createResultSettings() {
  resultsGrid.innerHTML = "";

  ["white", "black"].forEach((side) => {
    const group = document.createElement("section");
    group.className = "result-group";
    group.innerHTML = `
      <h3>${side === "white" ? "Weiß" : "Schwarz"}</h3>
      ${pieces
        .map(
          (piece) => `
            <div class="result-row">
              <label for="${side}-${piece.id}-result">${piece.name}</label>
              <input id="${side}-${piece.id}-result" data-side="${side}" data-piece="${piece.id}" type="number" step="1" value="${state.results[side][piece.id]}" />
            </div>
          `,
        )
        .join("")}
    `;
    resultsGrid.appendChild(group);
  });
}

function getPolarityLabel(assignment) {
  if (assignment.polarity === "positive") return "+";
  if (assignment.polarity === "negative") return "-";
  return "unausgewertet";
}

function handleDragStart(event) {
  const id = event.currentTarget.dataset.id;
  event.dataTransfer.setData("text/plain", id);
  event.dataTransfer.effectAllowed = "move";
}

function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drag-over");
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove("drag-over");
}

function handleDrop(event) {
  event.preventDefault();
  const id = Number(event.dataTransfer.getData("text/plain"));
  const assignment = state.assignments.find((item) => item.id === id);
  const cell = event.currentTarget;

  cell.classList.remove("drag-over");
  if (!assignment) return;

  assignment.side = cell.dataset.side;
  assignment.piece = cell.dataset.piece;
  render();
}

function handlePointerDragStart(event) {
  if (event.target.closest("button")) return;

  const id = Number(event.currentTarget.dataset.id);
  if (!id) return;

  event.preventDefault();
  pointerDrag = {
    id,
    ghost: document.createElement("div"),
  };
  pointerDrag.ghost.className = "drag-ghost";
  pointerDrag.ghost.textContent = theses[id - 1];
  document.body.appendChild(pointerDrag.ghost);

  movePointerGhost(event.clientX, event.clientY);
  window.addEventListener("pointermove", handlePointerDragMove);
  window.addEventListener("pointerup", handlePointerDragEnd, { once: true });
}

function handlePointerDragMove(event) {
  if (!pointerDrag) return;
  movePointerGhost(event.clientX, event.clientY);

  document.querySelectorAll(".drop-cell.drag-over").forEach((cell) => {
    cell.classList.remove("drag-over");
  });

  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".drop-cell");
  if (target) {
    target.classList.add("drag-over");
  }
}

function handlePointerDragEnd(event) {
  if (!pointerDrag) return;

  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".drop-cell");
  const assignment = state.assignments.find((item) => item.id === pointerDrag.id);

  if (target && assignment) {
    assignment.side = target.dataset.side;
    assignment.piece = target.dataset.piece;
  }

  pointerDrag.ghost.remove();
  pointerDrag = null;
  window.removeEventListener("pointermove", handlePointerDragMove);
  document.querySelectorAll(".drop-cell.drag-over").forEach((cell) => {
    cell.classList.remove("drag-over");
  });
  render();
}

function movePointerGhost(x, y) {
  pointerDrag.ghost.style.left = `${x}px`;
  pointerDrag.ghost.style.top = `${y}px`;
}

function getAssignmentScore(assignment) {
  if (!assignment.side || !assignment.piece || !assignment.polarity) return 0;
  return getBaseScore(assignment);
}

function getPlayerScore(side, pieceId) {
  return Number(state.results[side]?.[pieceId]) || 0;
}

function getSidePlayerScore(side) {
  return pieces.reduce((sum, piece) => sum + getPlayerScore(side, piece.id), 0);
}

function getScoreTone(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function getBaseScore(assignment) {
  if (!assignment.piece || !assignment.polarity) return 0;
  const piece = pieces.find((item) => item.id === assignment.piece);
  const sign = assignment.polarity === "positive" ? 1 : -1;

  if (piece.id === "knight") {
    if (assignment.polarity !== "positive") return 0;
    return state.questionValue ?? assignment.knightSwing;
  }

  if (piece.id === "bishop") {
    if (assignment.polarity !== "positive") return 0;
    return -piece.base;
  }

  if (piece.id === "queen") {
    if (assignment.polarity !== "positive") return 0;
    return piece.base;
  }

  if (piece.id === "rook") {
    return piece.base * sign * -1;
  }

  return piece.base * sign;
}

function calculateTotals() {
  const totals = {
    white: getSidePlayerScore("white"),
    black: getSidePlayerScore("black"),
  };

  state.assignments.forEach((assignment) => {
    if (assignment.side) {
      totals[assignment.side] += getAssignmentScore(assignment);
    }
  });

  return totals;
}

function renderPlacements() {
  document.querySelectorAll(".placed-list").forEach((slot) => {
    slot.innerHTML = "";
  });

  state.assignments.forEach((assignment) => {
    if (!assignment.side || !assignment.piece) return;
    const slot = document.querySelector(`[data-slot="${assignment.side}-${assignment.piece}"]`);
    if (!slot) return;

    const chip = document.createElement("span");
    const score = getAssignmentScore(assignment);
    chip.className = `placed-chip ${getScoreTone(score)}`;
    chip.draggable = true;
    chip.dataset.id = assignment.id;
    chip.innerHTML = `
      <strong class="chip-watermark">${getSignedNumber(score)}</strong>
      <span class="fit-text">${escapeHtml(theses[assignment.id - 1])}</span>
      <strong class="chip-score">${getSignedNumber(score)}</strong>
    `;
    chip.title = `${theses[assignment.id - 1]} ${getPolarityLabel(assignment)} ${getSignedNumber(score)}`;
    chip.addEventListener("dragstart", handleDragStart);
    chip.addEventListener("pointerdown", handlePointerDragStart);
    slot.appendChild(chip);
  });
}

function fitAllCardText() {
  requestAnimationFrame(() => {
    document.querySelectorAll(".thesis-card .fit-text, .placed-chip .fit-text").forEach((text) => {
      fitTextToContainer(text);
    });
  });
}

function fitTextToContainer(text) {
  const container = text.closest(".thesis-card, .placed-chip");
  if (!container) return;

  let size = text.closest(".placed-chip") ? 11 : 16;
  const minSize = text.closest(".placed-chip") ? 6 : 8;
  text.style.fontSize = `${size}px`;

  while (size > minSize && (text.scrollHeight > container.clientHeight - 4 || text.scrollWidth > text.clientWidth)) {
    size -= 1;
    text.style.fontSize = `${size}px`;
  }
}

function renderTotals() {
  const totals = calculateTotals();

  document.querySelector("#whiteTotal").textContent = totals.white;
  document.querySelector("#blackTotal").textContent = totals.black;

  ["white", "black"].forEach((side) => {
    const label = nameInputs[side].value.trim() || (side === "white" ? "Weiß" : "Schwarz");
    document.querySelector(`#${side}Label`).textContent = label;
  });
}

function render() {
  createBoard();
  createThesisList();
  createEvaluationList();
  renderPlacements();
  renderTotals();
  renderRandomizerState();
  renderTeamLogos();
  fitAllCardText();
}

function renderRandomizerState() {
  if (questionValueLabel) {
    questionValueLabel.textContent = state.questionValue === null ? "noch nicht gewürfelt" : getSignedNumber(state.questionValue);
  }
}

function getSignedNumber(value) {
  return value > 0 ? `+${value}` : String(value);
}

// Event listeners for logo upload
document.addEventListener('DOMContentLoaded', () => {
  // Logo upload buttons
  document.querySelectorAll('.logo-upload-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const team = btn.dataset.team;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) {
          handleLogoUpload(team, file);
        }
      });
      input.click();
    });
  });

  // Remove logo buttons
  document.querySelectorAll('.remove-logo-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const team = btn.dataset.team;
      removeTeamLogo(team);
    });
  });

  // Load logos and render
  loadTeamLogos();
  renderTeamLogos();
});

evaluationList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-polarity]");
  if (!button) return;

  const assignment = state.assignments.find((item) => item.id === Number(button.dataset.id));
  if (!assignment) return;

  assignment.polarity = button.dataset.polarity || null;
  render();
});

evaluationList.addEventListener("input", (event) => {
  const input = event.target;
  if (!input.matches('[data-field="thesis-text"]')) return;

  theses[Number(input.dataset.id) - 1] = input.value;
  createThesisList();
  renderPlacements();
  fitAllCardText();
});

function handleResultSettingChange(event) {
  const input = event.target;
  if (!input.matches("[data-side][data-piece]")) return;

  const side = input.dataset.side;
  const pieceId = input.dataset.piece;
  if (!KNOWN_SIDES.includes(side) || !KNOWN_PIECE_IDS.includes(pieceId)) return;

  state.results[side][pieceId] = Number(input.value) || 0;
  createBoard();
  renderPlacements();
  renderTotals();
  fitAllCardText();
}

resultsGrid.addEventListener("input", handleResultSettingChange);
resultsGrid.addEventListener("change", handleResultSettingChange);

Object.values(nameInputs).forEach((input) => {
  input.addEventListener("input", renderTotals);
});

window.addEventListener("resize", fitAllCardText);

openSettingsButton.addEventListener("click", () => {
  if (typeof settingsDialog.showModal === "function") {
    settingsDialog.showModal();
  } else {
    settingsDialog.setAttribute("open", "");
    settingsDialog.classList.add("is-open");
  }
});

closeSettingsButton.addEventListener("click", () => {
  if (typeof settingsDialog.close === "function") {
    settingsDialog.close();
  } else {
    settingsDialog.removeAttribute("open");
    settingsDialog.classList.remove("is-open");
  }
});

if (exportAllButton) {
  exportAllButton.addEventListener("click", exportAllData);
}

if (importAllButton && importFileInput) {
  importAllButton.addEventListener("click", () => importFileInput.click());

  importFileInput.addEventListener("change", () => {
    const file = importFileInput.files?.[0];
    importAllData(file);
    importFileInput.value = "";
  });
}

createBoard();
createResultSettings();
renderRandomizerState();
render();

randomQuestionButton.addEventListener("click", () => {
  const values = [-3, -2, -1, 1, 2, 3];
  state.questionValue = values[Math.floor(Math.random() * values.length)];
  render();
});