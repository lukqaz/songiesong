const audio = document.getElementById("audio");
const playBtn = document.getElementById("play-btn");
const playIcon = document.getElementById("play-icon");
const pauseIcon = document.getElementById("pause-icon");
const stageTimeEl = document.getElementById("stage-time");
const stageTrackEl = document.getElementById("stage-track");
const attemptsRow = document.getElementById("attempts-row");
const guessForm = document.getElementById("guess-form");
const guessInput = document.getElementById("guess-input");
const suggestionsEl = document.getElementById("suggestions");
const skipBtn = document.getElementById("skip-btn");
const historyEl = document.getElementById("guess-history");
const resultEl = document.getElementById("result");
const resultStatus = document.getElementById("result-status");
const resultSong = document.getElementById("result-song");
const resultCover = document.getElementById("result-cover");
const resultLink = document.getElementById("result-link");
const modeLabel = document.getElementById("mode-label");
const difficultyStack = document.getElementById("difficulty-stack");
const difficultyPills = document.getElementById("difficulty-pills");
const stageGrid = document.getElementById("stage-grid");
const rerollBtn = document.getElementById("reroll-btn");
const autoRerollCheckbox = document.getElementById("auto-reroll");
const volumeSlider = document.getElementById("volume-slider");
const volumeValue = document.getElementById("volume-value");
const startFromBeginBtn = document.getElementById("start-from-begin");
const startFromHookBtn = document.getElementById("start-from-hook");

// Alle waehlbaren Ausschnittslaengen in Sekunden (muss zum Server passen)
const STAGE_VALUES = [0.01, 0.1, 0.5, 2, 8, 15];

const DIFFICULTIES = [
  { id: "easy", label: "Easy", stages: [0.1, 0.5, 2, 8, 15] },
  { id: "medium", label: "Medium", stages: [0.1, 0.5, 2, 8] },
  { id: "hard", label: "Hard", stages: [0.01, 0.1, 0.5, 2] },
  { id: "expert", label: "Expert", stages: [0.01, 0.1, 0.5] },
  { id: "impossible", label: "Impossible", stages: [0.01, 0.1] },
];

let activeStages = [...DIFFICULTIES[0].stages];
let activeDifficultyId = "easy";
let useHookStart = false;

let round = {
  mode: "daily", // "daily" | "practice"
  roundId: null, // nur bei practice gesetzt
  date: null,
  previewUrl: null,
  hookAvailable: false,
  attempt: 0,
  history: [],
  finished: false,
  selectedSongId: null,
};

let playTimeout = null;

// --- Presets links + mittig rendern ---
function renderDifficultyControls() {
  difficultyStack.innerHTML = "";
  difficultyPills.innerHTML = "";

  DIFFICULTIES.forEach((d) => {
    const sideBtn = document.createElement("button");
    sideBtn.className = "side-btn";
    sideBtn.textContent = d.label;
    if (d.id === activeDifficultyId) sideBtn.style.background = "var(--green)";
    if (d.id === activeDifficultyId) sideBtn.style.color = "#06170e";
    sideBtn.addEventListener("click", () => applyDifficulty(d.id));
    difficultyStack.appendChild(sideBtn);

    const pill = document.createElement("button");
    pill.className = "pill";
    pill.textContent = d.label;
    if (d.id === activeDifficultyId) pill.classList.add(`active-${d.id}`);
    pill.addEventListener("click", () => applyDifficulty(d.id));
    difficultyPills.appendChild(pill);
  });
}

function applyDifficulty(id) {
  const preset = DIFFICULTIES.find((d) => d.id === id);
  if (!preset) return;
  activeDifficultyId = id;
  activeStages = [...preset.stages];
  renderDifficultyControls();
  renderStageGrid();
  renderStageTrack();
  renderAttempts();
  updateStageTime();
}

// --- Einzelne Stage-Chips rechts (manuelles Feintuning) ---
function renderStageGrid() {
  stageGrid.innerHTML = "";
  STAGE_VALUES.forEach((val) => {
    const chip = document.createElement("button");
    chip.className = "stage-chip";
    chip.textContent = `${val}s`;
    if (activeStages.includes(val)) chip.classList.add("active");
    chip.addEventListener("click", () => toggleStage(val));
    stageGrid.appendChild(chip);
  });
}

function toggleStage(val) {
  if (round.attempt > 0) return; // Stages nicht mitten in einer laufenden Runde aendern
  if (activeStages.includes(val)) {
    if (activeStages.length <= 1) return; // mindestens eine Stage muss bleiben
    activeStages = activeStages.filter((v) => v !== val);
  } else {
    activeStages = [...activeStages, val].sort((a, b) => a - b);
  }
  activeDifficultyId = null; // eigene Auswahl entspricht keinem Preset mehr
  renderDifficultyControls();
  renderStageGrid();
  renderStageTrack();
  renderAttempts();
  updateStageTime();
}

function renderStageTrack() {
  stageTrackEl.innerHTML = "";
  activeStages.forEach((_, i) => {
    const seg = document.createElement("div");
    seg.className = "seg";
    if (i < round.attempt) seg.classList.add("filled");
    else if (i === round.attempt) seg.classList.add("current");
    stageTrackEl.appendChild(seg);
  });
}

function currentStageSeconds() {
  const idx = Math.min(round.attempt, activeStages.length - 1);
  return activeStages[idx];
}

function updateStageTime() {
  stageTimeEl.textContent = `${currentStageSeconds()}s`;
}

function renderAttempts() {
  attemptsRow.innerHTML = "";
  activeStages.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = "attempt-dot";
    if (i < round.history.length) {
      dot.classList.add(round.history[i].correct ? "used-correct" : "used-wrong");
    } else if (i === round.attempt) {
      dot.classList.add("current");
    }
    attemptsRow.appendChild(dot);
  });
}

function renderHistory() {
  historyEl.innerHTML = "";
  round.history.forEach((entry) => {
    const li = document.createElement("li");
    li.className = entry.correct ? "correct" : "wrong";
    li.innerHTML = `<span>${entry.label}</span><span>${entry.correct ? "Richtig" : "Falsch"}</span>`;
    historyEl.appendChild(li);
  });
}

// --- Song-Start: Anfang vs. Hook ---
startFromBeginBtn.addEventListener("click", () => setHookMode(false));
startFromHookBtn.addEventListener("click", () => {
  if (!round.hookAvailable) return;
  setHookMode(true);
});

function setHookMode(useHook) {
  useHookStart = useHook;
  startFromBeginBtn.classList.toggle("active", !useHook);
  startFromHookBtn.classList.toggle("active", useHook);
}

function refreshHookAvailability() {
  startFromHookBtn.disabled = !round.hookAvailable;
  if (!round.hookAvailable) setHookMode(false);
}

// --- Lautstaerke ---
volumeSlider.addEventListener("input", () => {
  const v = Number(volumeSlider.value);
  audio.volume = v / 100;
  volumeValue.textContent = `${v}%`;
});
audio.volume = 1;

// --- Laden: taeglicher Song ---
async function loadDaily() {
  const res = await fetch("/api/game/today");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showBlockingMessage(err.error || "Spiel aktuell nicht verfuegbar.");
    return;
  }
  const data = await res.json();
  applyRoundData(data);
  modeLabel.textContent = "Taegliche Runde";

  const saved = loadSavedDailyState(data.date);
  if (saved) {
    round.attempt = saved.attempt;
    round.history = saved.history;
    round.finished = saved.finished;
  }
  round.date = data.date;

  renderAll();
  if (round.finished && saved?.reveal) showResult(saved.reveal, saved.won);
}

function loadSavedDailyState(date) {
  try {
    const raw = localStorage.getItem("tageslied_" + date);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistDailyState(extra = {}) {
  if (round.mode !== "daily") return;
  localStorage.setItem(
    "tageslied_" + round.date,
    JSON.stringify({ attempt: round.attempt, history: round.history, finished: round.finished, ...extra })
  );
}

// --- Practice / Reroll ---
async function loadRandom() {
  const res = await fetch("/api/game/random");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showBlockingMessage(err.error || "Kein Song-Pool vorhanden.");
    return;
  }
  const data = await res.json();
  applyRoundData(data);
  round.roundId = data.roundId;
  modeLabel.textContent = "Practice-Runde";
  renderAll();
}

function applyRoundData(data) {
  audio.src = data.previewUrl;
  round.mode = data.mode;
  round.previewUrl = data.previewUrl;
  round.hookAvailable = Boolean(data.hookAvailable);
  round.attempt = 0;
  round.history = [];
  round.finished = false;
  round.selectedSongId = null;
  resultEl.hidden = true;
  guessForm.hidden = false;
  refreshHookAvailability();
}

function showBlockingMessage(text) {
  resultEl.hidden = false;
  guessForm.hidden = true;
  resultStatus.textContent = "Hinweis";
  resultSong.textContent = text;
  resultCover.removeAttribute("src");
  resultLink.style.display = "none";
}

rerollBtn.addEventListener("click", () => loadRandom());

// --- Wiedergabe ---
playBtn.addEventListener("click", () => {
  if (round.finished) return;
  if (audio.paused) playSnippet();
  else stopSnippet();
});

function playSnippet() {
  const seconds = currentStageSeconds();
  const startAt = useHookStart && round.hookOffsetSeconds ? round.hookOffsetSeconds : 0;
  audio.currentTime = startAt;
  audio.play().catch(() => {});
  playIcon.style.display = "none";
  pauseIcon.style.display = "block";

  clearTimeout(playTimeout);
  playTimeout = setTimeout(() => stopSnippet(), seconds * 1000);
}

function stopSnippet() {
  audio.pause();
  clearTimeout(playTimeout);
  playIcon.style.display = "block";
  pauseIcon.style.display = "none";
}

// --- Autocomplete ---
let suggestionTimer = null;
guessInput.addEventListener("input", () => {
  round.selectedSongId = null;
  clearTimeout(suggestionTimer);
  const q = guessInput.value.trim();
  if (q.length < 2) {
    suggestionsEl.innerHTML = "";
    return;
  }
  suggestionTimer = setTimeout(async () => {
    const res = await fetch(`/api/game/suggestions?q=${encodeURIComponent(q)}`);
    const items = await res.json();
    renderSuggestions(items);
  }, 200);
});

function renderSuggestions(items) {
  suggestionsEl.innerHTML = "";

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "suggestion-item";

    li.innerHTML = `
      <img
        class="suggestion-cover"
        src="${item.coverUrl || ""}"
        alt=""
      />

      <div class="suggestion-info">
        <div class="suggestion-title">
          ${escapeHtml(item.title)}
        </div>

        <div class="s-artist">
          ${escapeHtml(item.artist)}
        </div>
      </div>
    `;

    li.addEventListener("click", () => {
      guessInput.value = `${item.title} - ${item.artist}`;
      round.selectedSongId = item.id;
      suggestionsEl.innerHTML = "";
      submitGuess(item.id, guessInput.value);
    });

    suggestionsEl.appendChild(li);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".input-wrap")) suggestionsEl.innerHTML = "";
});

skipBtn.addEventListener("click", () => {
  if (!round.finished) submitGuess(null, "Uebersprungen");
});

async function submitGuess(songId, label) {
  if (round.finished) return;
  stopSnippet();
  const attemptNumber = round.attempt + 1;

  const res = await fetch("/api/game/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      songId,
      attempt: attemptNumber,
      maxAttempts: activeStages.length,
      roundId: round.mode === "practice" ? round.roundId : undefined,
    }),
  });
  const data = await res.json();

  round.history.push({ label, correct: !!data.correct });
  round.attempt = attemptNumber;
  guessInput.value = "";

  const gameOver = data.correct || round.attempt >= activeStages.length;
  if (gameOver) round.finished = true;

  renderAttempts();
  renderStageTrack();
  renderHistory();
  updateStageTime();

  if (gameOver && data.reveal) {
    showResult(data.reveal, data.correct);
    persistDailyState({ reveal: data.reveal, won: data.correct });
    if (round.mode === "practice" && autoRerollCheckbox.checked) {
      setTimeout(() => loadRandom(), 1800);
    }
  } else {
    persistDailyState();
  }
}

function showResult(reveal, won) {
  resultEl.hidden = false;
  guessForm.hidden = true;
  resultLink.style.display = "inline";
  resultStatus.textContent = won ? "Richtig erraten!" : "Leider nicht erraten";
  resultSong.textContent = `${reveal.title} - ${reveal.artist}`;
  resultCover.src = reveal.coverUrl || "";
  resultLink.href = reveal.spotifyUrl || "#";
}

function renderAll() {
  renderDifficultyControls();
  renderStageGrid();
  renderStageTrack();
  renderAttempts();
  renderHistory();
  updateStageTime();
  refreshHookAvailability();
}

renderAll();
loadDaily();
