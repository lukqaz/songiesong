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
const resultClose = document.getElementById("result-close");
const modeLabel = document.getElementById("mode-label");
const difficultyStack = document.getElementById("difficulty-stack");
const difficultyPills = document.getElementById("difficulty-pills");
const stageGrid = document.getElementById("stage-grid");
const rerollBtn = document.getElementById("reroll-btn");
const volumeSlider = document.getElementById("volume-slider");
const volumeValue = document.getElementById("volume-value");
const startFromBeginBtn = document.getElementById("start-from-begin");
const startFromHookBtn = document.getElementById("start-from-hook");

const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const settingsClose = document.getElementById("settings-close");
const languageButtons = document.querySelectorAll("[data-language]");

// Alle waehlbaren Ausschnittslaengen in Sekunden
const STAGE_VALUES = [0.01, 0.1, 0.5, 2, 8, 15];

const DIFFICULTIES = [
  {
    id: "easy",
    label: "easy",
    stages: [0.1, 0.5, 2, 8, 15],
  },
  {
    id: "medium",
    label: "medium",
    stages: [0.1, 0.5, 2, 8],
  },
  {
    id: "hard",
    label: "hard",
    stages: [0.01, 0.1, 0.5, 2],
  },
  {
    id: "expert",
    label: "expert",
    stages: [0.01, 0.1, 0.5],
  },
  {
    id: "impossible",
    label: "impossible",
    stages: [0.01, 0.1],
  },
];

const translations = {
  en: {
    settings: "Settings",
    language: "Language",
    normal: "Normal",
    newSong: "New Song",
    filter: "Filter",
    feedback: "Feedback",
    searchSongs: "Search songs...",
    guessSong: "Guess the song",
    playSnippet: "Play snippet",
    skip: "Skip",
    songStart: "Song Start",
    fromBeginning: "From beginning",
    fromHook: "Main Hook",
    stages: "Stages",
    volume: "Volume",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    expert: "Expert",
    impossible: "Impossible",
    listenSpotify: "Listen on Spotify",
    close: "Close",
    youGotIt: "You got it! ✓",
    songWas: "The song was:",
    correct: "Correct",
    wrong: "Wrong",
    skipped: "Skipped",
    notice: "Notice",
    noSongPool: "No songs available. Import a playlist in the admin panel first.",
    roundExpired: "Round expired. Please start a new song.",
    unavailable: "Game currently unavailable.",
  },

  de: {
    settings: "Einstellungen",
    language: "Sprache",
    normal: "Normal",
    newSong: "Neuer Song",
    filter: "Filter",
    feedback: "Feedback",
    searchSongs: "Songs durchsuchen...",
    guessSong: "Song erraten",
    playSnippet: "Ausschnitt abspielen",
    skip: "Überspringen",
    songStart: "Song-Start",
    fromBeginning: "Von Anfang an",
    fromHook: "Main Hook",
    stages: "Stages",
    volume: "Lautstärke",
    easy: "Einfach",
    medium: "Mittel",
    hard: "Schwer",
    expert: "Experte",
    impossible: "Unmöglich",
    listenSpotify: "Auf Spotify anhören",
    close: "Schließen",
    youGotIt: "Du hast es! ✓",
    songWas: "Der Song war:",
    correct: "Richtig",
    wrong: "Falsch",
    skipped: "Übersprungen",
    notice: "Hinweis",
    noSongPool: "Keine Songs verfügbar. Importiere zuerst eine Playlist im Admin-Bereich.",
    roundExpired: "Runde abgelaufen. Bitte starte einen neuen Song.",
    unavailable: "Das Spiel ist aktuell nicht verfügbar.",
  },
};

let currentLanguage = localStorage.getItem("songguessr_language") || "en";

let activeStages = [...DIFFICULTIES[0].stages];
let activeDifficultyId = "easy";
let useHookStart = false;

let round = {
  mode: "normal",
  roundId: null,
  previewUrl: null,
  hookAvailable: false,
  hookOffsetSeconds: 0,
  attempt: 0,
  history: [],
  finished: false,
  selectedSongId: null,
};

let playbackFrame = null;
let loadingRound = false;

// --------------------------------------------------
// Translation
// --------------------------------------------------

function t(key) {
  return translations[currentLanguage]?.[key] ?? translations.en[key] ?? key;
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute(
      "aria-label",
      t(element.dataset.i18nAriaLabel)
    );
  });

  languageButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.language === currentLanguage
    );
  });

  renderDifficultyControls();
  renderHistory();
  renderAttempts();
  updateStageTime();
}

function setLanguage(language) {
  if (!translations[language]) return;

  currentLanguage = language;

  localStorage.setItem(
    "songguessr_language",
    currentLanguage
  );

  applyLanguage();
}

// --------------------------------------------------
// Settings
// --------------------------------------------------

settingsBtn.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

settingsClose.addEventListener("click", () => {
  settingsPanel.hidden = true;
});

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.language);
  });
});

document.addEventListener("click", (event) => {
  if (
    !settingsPanel.hidden &&
    !event.target.closest(".settings-panel") &&
    !event.target.closest("#settings-btn")
  ) {
    settingsPanel.hidden = true;
  }
});

// --------------------------------------------------
// Difficulty
// --------------------------------------------------

function renderDifficultyControls() {
  difficultyStack.innerHTML = "";
  difficultyPills.innerHTML = "";

  DIFFICULTIES.forEach((difficulty) => {
    const label = t(difficulty.label);

    const sideBtn = document.createElement("button");
    sideBtn.className = "side-btn";
    sideBtn.textContent = label;

    if (difficulty.id === activeDifficultyId) {
      sideBtn.style.background = "var(--green)";
      sideBtn.style.color = "#06170e";
    }

    sideBtn.addEventListener("click", () => {
      applyDifficulty(difficulty.id);
    });

    difficultyStack.appendChild(sideBtn);

    const pill = document.createElement("button");
    pill.className = "pill";
    pill.textContent = label;

    if (difficulty.id === activeDifficultyId) {
      pill.classList.add(`active-${difficulty.id}`);
    }

    pill.addEventListener("click", () => {
      applyDifficulty(difficulty.id);
    });

    difficultyPills.appendChild(pill);
  });
}

function applyDifficulty(id) {
  const preset = DIFFICULTIES.find(
    (difficulty) => difficulty.id === id
  );

  if (!preset) return;

  activeDifficultyId = id;
  activeStages = [...preset.stages];

  renderDifficultyControls();
  renderStageGrid();
  renderStageTrack();
  renderAttempts();
  updateStageTime();
}

// --------------------------------------------------
// Stage grid
// --------------------------------------------------

function renderStageGrid() {
  stageGrid.innerHTML = "";

  STAGE_VALUES.forEach((value) => {
    const chip = document.createElement("button");

    chip.className = "stage-chip";
    chip.textContent = `${value}s`;

    if (activeStages.includes(value)) {
      chip.classList.add("active");
    }

    chip.addEventListener("click", () => {
      toggleStage(value);
    });

    stageGrid.appendChild(chip);
  });
}

function toggleStage(value) {
  if (round.attempt > 0) return;

  if (activeStages.includes(value)) {
    if (activeStages.length <= 1) return;

    activeStages = activeStages.filter(
      (stage) => stage !== value
    );
  } else {
    activeStages = [...activeStages, value].sort(
      (a, b) => a - b
    );
  }

  activeDifficultyId = null;

  renderDifficultyControls();
  renderStageGrid();
  renderStageTrack();
  renderAttempts();
  updateStageTime();
}

// --------------------------------------------------
// Stage track
// --------------------------------------------------

function renderStageTrack() {
  stageTrackEl.innerHTML = "";

  activeStages.forEach((_, index) => {
    const segment = document.createElement("div");

    segment.className = "seg";

    if (index < round.attempt) {
      segment.classList.add("filled");
    } else if (index === round.attempt) {
      segment.classList.add("current");
    }

    stageTrackEl.appendChild(segment);
  });
}

function currentStageSeconds() {
  const index = Math.min(
    round.attempt,
    activeStages.length - 1
  );

  return activeStages[index];
}

function updateStageTime() {
  stageTimeEl.textContent = `${currentStageSeconds()}s`;
}

// --------------------------------------------------
// Attempts
// --------------------------------------------------

function renderAttempts() {
  attemptsRow.innerHTML = "";

  activeStages.forEach((_, index) => {
    const dot = document.createElement("div");

    dot.className = "attempt-dot";

    if (index < round.history.length) {
      dot.classList.add(
        round.history[index].correct
          ? "used-correct"
          : "used-wrong"
      );
    } else if (index === round.attempt) {
      dot.classList.add("current");
    }

    attemptsRow.appendChild(dot);
  });
}

// --------------------------------------------------
// History
// --------------------------------------------------

function renderHistory() {
  historyEl.innerHTML = "";

  round.history.forEach((entry) => {
    const li = document.createElement("li");

    li.className = entry.correct
      ? "correct"
      : "wrong";

    li.innerHTML = `
      <span>${escapeHtml(entry.label)}</span>
      <span>
        ${
          entry.correct
            ? t("correct")
            : entry.label === t("skipped")
              ? t("skipped")
              : t("wrong")
        }
      </span>
    `;

    historyEl.appendChild(li);
  });
}

// --------------------------------------------------
// Song start
// --------------------------------------------------

startFromBeginBtn.addEventListener("click", () => {
  setHookMode(false);
});

startFromHookBtn.addEventListener("click", () => {
  if (!round.hookAvailable) return;

  setHookMode(true);
});

function setHookMode(useHook) {
  useHookStart = useHook;

  startFromBeginBtn.classList.toggle(
    "active",
    !useHook
  );

  startFromHookBtn.classList.toggle(
    "active",
    useHook
  );
}

function refreshHookAvailability() {
  startFromHookBtn.disabled = !round.hookAvailable;

  if (!round.hookAvailable) {
    setHookMode(false);
  }
}

// --------------------------------------------------
// Volume
// --------------------------------------------------

volumeSlider.addEventListener("input", () => {
  const value = Number(volumeSlider.value);

  audio.volume = value / 100;
  volumeValue.textContent = `${value}%`;
});

audio.volume = 1;

// --------------------------------------------------
// Load normal/random round
// --------------------------------------------------

async function loadRandom() {
  if (loadingRound) return;

  loadingRound = true;

  stopSnippet();

  try {
    const res = await fetch("/api/game/random", {
      cache: "no-store",
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));

      showBlockingMessage(
        error.error || t("noSongPool")
      );

      return;
    }

    const data = await res.json();

    applyRoundData(data);

    round.roundId = data.roundId;

    renderAll();

    guessInput.focus();
  } catch (error) {
    console.error("Round loading error:", error);

    showBlockingMessage(
      t("unavailable")
    );
  } finally {
    loadingRound = false;
  }
}

function applyRoundData(data) {
  stopSnippet();

  audio.src = data.previewUrl || "";

  round.mode = "normal";
  round.roundId = data.roundId || null;
  round.previewUrl = data.previewUrl || null;
  round.hookAvailable = Boolean(
    data.hookAvailable
  );

  round.hookOffsetSeconds =
    Number(data.hookOffsetSeconds) || 0;

  round.attempt = 0;
  round.history = [];
  round.finished = false;
  round.selectedSongId = null;

  resultEl.hidden = true;
  guessForm.hidden = false;

  guessInput.value = "";
  suggestionsEl.innerHTML = "";

  refreshHookAvailability();

  playIcon.style.display = "block";
  pauseIcon.style.display = "none";
}

function showBlockingMessage(text) {
  resultEl.hidden = false;
  guessForm.hidden = true;

  const modal = resultEl.querySelector(
    ".result-modal"
  );

  if (modal) {
    modal.classList.remove("won", "lost");
  }

  resultStatus.textContent = t("notice");
  resultSong.textContent = text;

  resultCover.removeAttribute("src");
  resultLink.style.display = "none";
}

rerollBtn.addEventListener("click", () => {
  loadRandom();
});

// --------------------------------------------------
// Playback
// --------------------------------------------------

playBtn.addEventListener("click", () => {
  if (round.finished) return;

  if (audio.paused) {
    playSnippet();
  } else {
    stopSnippet();
  }
});

function playSnippet() {
  const seconds = currentStageSeconds();

  const startAt =
    useHookStart &&
    round.hookOffsetSeconds
      ? round.hookOffsetSeconds
      : 0;

  cancelPlaybackLoop();

  try {
    audio.currentTime = startAt;
  } catch {
    return;
  }

  audio
    .play()
    .then(() => {
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";

      const endTime = startAt + seconds;

      function checkPlaybackEnd() {
        if (audio.paused) {
          playbackFrame = null;
          return;
        }

        if (audio.currentTime >= endTime) {
          stopSnippet();
          return;
        }

        playbackFrame = requestAnimationFrame(
          checkPlaybackEnd
        );
      }

      playbackFrame = requestAnimationFrame(
        checkPlaybackEnd
      );
    })
    .catch(() => {
      stopSnippet();
    });
}

function cancelPlaybackLoop() {
  if (playbackFrame !== null) {
    cancelAnimationFrame(playbackFrame);
    playbackFrame = null;
  }
}

function stopSnippet() {
  cancelPlaybackLoop();

  audio.pause();

  playIcon.style.display = "block";
  pauseIcon.style.display = "none";
}

// --------------------------------------------------
// Autocomplete
// --------------------------------------------------

let suggestionTimer = null;

guessInput.addEventListener("input", () => {
  round.selectedSongId = null;

  clearTimeout(suggestionTimer);

  const query = guessInput.value.trim();

  if (query.length < 2) {
    suggestionsEl.innerHTML = "";
    return;
  }

  suggestionTimer = setTimeout(async () => {
    try {
      const res = await fetch(
        `/api/game/suggestions?q=${encodeURIComponent(query)}`
      );

      const items = await res.json();

      renderSuggestions(items);
    } catch (error) {
      console.error(
        "Autocomplete error:",
        error
      );

      suggestionsEl.innerHTML = "";
    }
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
      guessInput.value =
        `${item.title} - ${item.artist}`;

      round.selectedSongId = item.id;

      suggestionsEl.innerHTML = "";

      submitGuess(
        item.id,
        guessInput.value
      );
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

document.addEventListener("click", (event) => {
  if (!event.target.closest(".input-wrap")) {
    suggestionsEl.innerHTML = "";
  }
});

// --------------------------------------------------
// Skip
// --------------------------------------------------

skipBtn.addEventListener("click", () => {
  if (!round.finished) {
    submitGuess(
      null,
      t("skipped")
    );
  }
});

// --------------------------------------------------
// Guess
// --------------------------------------------------

guessForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (
    round.selectedSongId &&
    !round.finished
  ) {
    submitGuess(
      round.selectedSongId,
      guessInput.value
    );
  }
});

async function submitGuess(songId, label) {
  if (round.finished) return;

  if (!round.roundId) {
    showBlockingMessage(
      t("roundExpired")
    );

    return;
  }

  stopSnippet();

  try {
    audio.currentTime = 0;
  } catch {}

  playIcon.style.display = "block";
  pauseIcon.style.display = "none";

  const attemptNumber =
    round.attempt + 1;

  let res;

  try {
    res = await fetch("/api/game/guess", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        songId,
        attempt: attemptNumber,
        maxAttempts: activeStages.length,
        roundId: round.roundId,
      }),
    });
  } catch (error) {
    console.error(
      "Guess request failed:",
      error
    );

    return;
  }

  const data = await res.json().catch(
    () => ({})
  );

  if (!res.ok) {
    showBlockingMessage(
      data.error || t("roundExpired")
    );

    return;
  }

  round.history.push({
    label,
    correct: Boolean(data.correct),
  });

  round.attempt = attemptNumber;
  guessInput.value = "";
  round.selectedSongId = null;

  const gameOver =
    Boolean(data.correct) ||
    round.attempt >= activeStages.length;

  if (gameOver) {
    round.finished = true;
  }

  renderAttempts();
  renderStageTrack();
  renderHistory();
  updateStageTime();

  if (gameOver && data.reveal) {
    showResult(
      data.reveal,
      Boolean(data.correct)
    );
  }
}

// --------------------------------------------------
// Result
// --------------------------------------------------

function showResult(reveal, won) {
  resultEl.hidden = false;
  guessForm.hidden = true;

  const modal = resultEl.querySelector(
    ".result-modal"
  );

  if (modal) {
    modal.classList.toggle(
      "won",
      won
    );

    modal.classList.toggle(
      "lost",
      !won
    );
  }

  resultStatus.textContent = won
    ? t("youGotIt")
    : t("songWas");

  resultSong.textContent =
    `${reveal.title} - ${reveal.artist}`;

  resultCover.src =
    reveal.coverUrl || "";

  resultLink.style.display = "inline";
  resultLink.href =
    reveal.spotifyUrl || "#";

  // Ergebnis-Song komplett abspielen
  stopSnippet();

  try {
    audio.currentTime = 0;
  } catch {}

  audio.play().catch(() => {});

  playIcon.style.display = "none";
  pauseIcon.style.display = "block";
}

// --------------------------------------------------
// Close result -> automatically load new song
// --------------------------------------------------

resultClose.addEventListener("click", async () => {
  stopSnippet();

  try {
    audio.currentTime = 0;
  } catch {}

  resultEl.hidden = true;

  guessForm.hidden = false;

  await loadRandom();
});

// --------------------------------------------------
// Everything
// --------------------------------------------------

function renderAll() {
  renderDifficultyControls();
  renderStageGrid();
  renderStageTrack();
  renderAttempts();
  renderHistory();
  updateStageTime();
  refreshHookAvailability();
}

applyLanguage();
renderAll();
loadRandom();
