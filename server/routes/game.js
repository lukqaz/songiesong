const express = require("express");
const { loadPool } = require("../songPool");

const router = express.Router();

// Alle waehlbaren Ausschnittslaengen
// in Sekunden
const STAGE_VALUES = [
  0.01,
  0.1,
  0.5,
  2,
  8,
  15,
];

/*
 * ==================================================
 * DAILY MODE — DISABLED
 * ==================================================
 *
 * Daily bleibt absichtlich als auskommentierter
 * Platzhalter erhalten.
 *
 * Es wird aktuell NICHT verwendet und beeinflusst
 * den normalen Spielmodus in keiner Weise.
 *
 * Falls Daily spaeter wieder gebraucht wird, kann
 * die alte /today-Route hier wieder aktiviert werden.
 *
 * --------------------------------------------------
 *
 * router.get("/today", (req, res) => {
 *   const pool = loadPool();
 *   const song = getDailySong(pool);
 *
 *   if (!song) {
 *     return res.status(503).json({
 *       error:
 *         "No daily song available.",
 *     });
 *   }
 *
 *   res.json({
 *     mode: "daily",
 *     date: new Date()
 *       .toISOString()
 *       .slice(0, 10),
 *     previewUrl: song.previewUrl,
 *     hookAvailable:
 *       Boolean(song.hookStartMs),
 *     stageValues:
 *       STAGE_VALUES,
 *   });
 * });
 *
 * ==================================================
 */

// --------------------------------------------------
// Normal game rounds
// --------------------------------------------------

// Speichert serverseitig, welcher Song
// zu welcher Runde gehoert.
const normalRounds = new Map();

const ROUND_TTL_MS =
  30 * 60 * 1000;

function cleanupRounds() {
  const now = Date.now();

  for (
    const [id, round] of normalRounds
  ) {
    if (
      now - round.createdAt >
      ROUND_TTL_MS
    ) {
      normalRounds.delete(id);
    }
  }
}

// --------------------------------------------------
// Random / Normal Song
// --------------------------------------------------

router.get(
  "/random",
  (req, res) => {
    cleanupRounds();

    const pool = loadPool();

    if (
      !pool.songs ||
      pool.songs.length === 0
    ) {
      return res.status(503).json({
        error:
          "No songs available. Import a playlist in the admin panel first.",
      });
    }

    const song =
      pool.songs[
        Math.floor(
          Math.random() *
            pool.songs.length
        )
      ];

    const roundId =
      `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;

    normalRounds.set(
      roundId,
      {
        songId: song.id,
        createdAt: Date.now(),
      }
    );

    res.json({
      mode: "normal",

      roundId,

      // Deezer:
      // wird immer fuer "From beginning"
      // verwendet und dient als Fallback.
      previewUrl:
        song.previewUrl || null,

      // Spotify:
      // wird nur verwendet, wenn
      // "Main Hook" ausgewaehlt ist
      // und eine Preview existiert.
      spotifyPreviewUrl:
        song.spotifyPreviewUrl ||
        null,

      stageValues:
        STAGE_VALUES,
    });
  }
);

// --------------------------------------------------
// Autocomplete
// --------------------------------------------------

router.get(
  "/suggestions",
  (req, res) => {
    const query =
      (req.query.q || "")
        .toLowerCase()
        .trim();

    const pool = loadPool();

    const list =
      pool.songs.map(
        (song) => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          coverUrl:
            song.coverUrl,
        })
      );

    if (!query) {
      return res.json([]);
    }

    // Kein kuenstliches Limit mehr.
    // Alle passenden Songs werden zurueckgegeben.
    const results =
      list.filter(
        (song) =>
          song.title
            .toLowerCase()
            .includes(query) ||
          song.artist
            .toLowerCase()
            .includes(query)
      );

    res.json(results);
  }
);

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

    /*
     * Normal mode always requires a roundId.
     *
     * There is intentionally NO fallback
     * to Daily here.
     */
    if (
      !roundId ||
      !normalRounds.has(roundId)
    ) {
      return res.status(400).json({
        error:
          "Round expired. Please start a new song.",
      });
    }

    const gameRound =
      normalRounds.get(
        roundId
      );

    const answer =
      pool.songs.find(
        (song) =>
          song.id ===
          gameRound.songId
      ) || null;

    if (!answer) {
      normalRounds.delete(
        roundId
      );

      return res.status(503).json({
        error:
          "No song available for this round.",
      });
    }

    const isCorrect =
      songId === answer.id;

    const isLastAttempt =
      Number(attempt) >=
      Number(
        maxAttempts || 6
      );

    const response = {
      correct: isCorrect,
    };

    if (
      isCorrect ||
      isLastAttempt
    ) {
      response.reveal = {
        title:
          answer.title,

        artist:
          answer.artist,

        coverUrl:
          answer.coverUrl,

        spotifyUrl:
          answer.spotifyUrl,
      };

      normalRounds.delete(
        roundId
      );
    }

    res.json(response);
  }
);

module.exports = router;
