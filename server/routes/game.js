const express = require("express");
const { loadPool } = require("../songPool");

const router = express.Router();

// Alle waehlbaren Ausschnittslaengen in Sekunden
const STAGE_VALUES = [0.01, 0.1, 0.5, 2, 8, 15];

// --------------------------------------------------
// Normal game rounds
// --------------------------------------------------

// Merkt sich, welcher Song zu welcher Runde gehoert.
// Die eigentliche Song-ID wird nur serverseitig gespeichert.
const normalRounds = new Map();

const ROUND_TTL_MS = 30 * 60 * 1000;

function cleanupRounds() {
  const now = Date.now();

  for (const [id, round] of normalRounds) {
    if (now - round.createdAt > ROUND_TTL_MS) {
      normalRounds.delete(id);
    }
  }
}

// --------------------------------------------------
// Random song
// --------------------------------------------------

router.get("/random", (req, res) => {
  cleanupRounds();

  const pool = loadPool();

  if (!pool.songs || pool.songs.length === 0) {
    return res.status(503).json({
      error:
        "No songs available. Import a playlist in the admin panel first.",
    });
  }

  const song =
    pool.songs[
      Math.floor(
        Math.random() * pool.songs.length
      )
    ];

  const roundId =
    `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

  normalRounds.set(roundId, {
    songId: song.id,
    createdAt: Date.now(),
  });

  res.json({
    mode: "normal",
    roundId,

    previewUrl: song.previewUrl,

    hookAvailable: Boolean(
      song.hookStartMs
    ),

    hookOffsetSeconds:
      song.hookStartMs
        ? song.hookStartMs / 1000
        : 0,

    stageValues: STAGE_VALUES,
  });
});

// --------------------------------------------------
// Autocomplete suggestions
// --------------------------------------------------

router.get("/suggestions", (req, res) => {
  const query = (req.query.q || "")
    .toLowerCase()
    .trim();

  const pool = loadPool();

  const list = pool.songs.map((song) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    coverUrl: song.coverUrl,
  }));

  if (!query) {
    return res.json([]);
  }

  const results = list
    .filter(
      (song) =>
        song.title
          .toLowerCase()
          .includes(query) ||
        song.artist
          .toLowerCase()
          .includes(query)
    )
    .slice(0, 8);

  res.json(results);
});

// --------------------------------------------------
// Guess
// --------------------------------------------------

router.post(
  "/guess",
  express.json(),
  (req, res) => {
    const {
      songId,
      attempt,
      maxAttempts,
      roundId,
    } = req.body;

    cleanupRounds();

    const pool = loadPool();

    if (
      !roundId ||
      !normalRounds.has(roundId)
    ) {
      return res.status(400).json({
        error:
          "Round expired. Please start a new song.",
      });
    }

    const round =
      normalRounds.get(roundId);

    const answer =
      pool.songs.find(
        (song) =>
          song.id === round.songId
      ) || null;

    if (!answer) {
      normalRounds.delete(roundId);

      return res.status(503).json({
        error:
          "No song available for this round.",
      });
    }

    const isCorrect =
      songId === answer.id;

    const isLastAttempt =
      Number(attempt) >=
      Number(maxAttempts || 6);

    const response = {
      correct: isCorrect,
    };

    if (
      isCorrect ||
      isLastAttempt
    ) {
      response.reveal = {
        title: answer.title,
        artist: answer.artist,
        coverUrl: answer.coverUrl,
        spotifyUrl: answer.spotifyUrl,
      };

      normalRounds.delete(roundId);
    }

    res.json(response);
  }
);

module.exports = router;
