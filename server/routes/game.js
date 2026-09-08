const express = require("express");
const { loadPool, getDailySong, getPublicSongList } = require("../songPool");

const router = express.Router();

// Alle waehlbaren Ausschnittslaengen in Sekunden (siehe STAGES im UI)
const STAGE_VALUES = [0.01, 0.1, 0.5, 2, 8, 15];

router.get("/today", (req, res) => {
  const pool = loadPool();
  const song = getDailySong(pool);
  if (!song) {
    return res.status(503).json({
      error: "Noch kein Song-Pool vorhanden. Bitte zuerst unter /admin.html eine Playlist importieren.",
    });
  }

  res.json({
    mode: "daily",
    date: new Date().toISOString().slice(0, 10),
    previewUrl: song.previewUrl,
    hookAvailable: Boolean(song.hookStartMs),
    stageValues: STAGE_VALUES,
  });
});

// Merkt sich, welcher Song zu welcher Practice-Runde gehoert (nur im
// Server-Speicher, wird dem Client nie mitgeteilt). Alte Runden verfallen
// nach einer Weile, damit der Speicher nicht unbegrenzt waechst.
const practiceRounds = new Map();
const ROUND_TTL_MS = 30 * 60 * 1000;

function cleanupRounds() {
  const now = Date.now();
  for (const [id, round] of practiceRounds) {
    if (now - round.createdAt > ROUND_TTL_MS) practiceRounds.delete(id);
  }
}

// Zufaelliger Song fuer den Practice-Modus (Reroll-Button im UI)
router.get("/random", (req, res) => {
  cleanupRounds();
  const pool = loadPool();
  if (!pool.songs || pool.songs.length === 0) {
    return res.status(503).json({ error: "Noch kein Song-Pool vorhanden." });
  }
  const song = pool.songs[Math.floor(Math.random() * pool.songs.length)];
  const roundId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  practiceRounds.set(roundId, { songId: song.id, createdAt: Date.now() });

  res.json({
    mode: "practice",
    roundId,
    previewUrl: song.previewUrl,
    hookAvailable: Boolean(song.hookStartMs),
    stageValues: STAGE_VALUES,
  });
});

router.get("/suggestions", (req, res) => {
  const query = (req.query.q || "").toLowerCase().trim();
  const pool = loadPool();
  const list = getPublicSongList(pool);

  if (!query) return res.json([]);

  const results = list
    .filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.artist.toLowerCase().includes(query)
    )
    .slice(0, 8);

  res.json(results);
});

router.post("/guess", express.json(), (req, res) => {
  const { songId, attempt, maxAttempts, roundId } = req.body;
  const pool = loadPool();

  let answer = null;
  if (roundId) {
    const round = practiceRounds.get(roundId);
    if (!round) {
      return res.status(400).json({ error: "Practice-Runde abgelaufen oder unbekannt. Bitte neu wuerfeln." });
    }
    answer = pool.songs.find((s) => s.id === round.songId) || null;
  } else {
    answer = getDailySong(pool);
  }

  if (!answer) {
    return res.status(503).json({ error: "Kein Song fuer diese Runde verfuegbar." });
  }

  const isCorrect = songId === answer.id;
  const isLastAttempt = attempt >= (maxAttempts || 6);

  const response = { correct: isCorrect };

  if (isCorrect || isLastAttempt) {
    response.reveal = {
      title: answer.title,
      artist: answer.artist,
      coverUrl: answer.coverUrl,
      spotifyUrl: answer.spotifyUrl,
    };
    if (roundId) practiceRounds.delete(roundId);
  }

  res.json(response);
});

module.exports = router;
