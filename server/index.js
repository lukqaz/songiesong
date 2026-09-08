require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const path = require("path");

const {
  getAuthorizationUrl,
  exchangeCodeForTokens,
} = require("./spotify");

const gameRoutes = require("./routes/game");
const adminRoutes = require("./routes/admin");
const { loadPool } = require("./songPool");

const app = express();
const PORT = process.env.PORT || 3000;

// Spotify OAuth State
let spotifyOAuthState = null;

// Statische Dateien
app.use(express.static(path.join(__dirname, "..", "public")));

// API-Routen
app.use("/api/game", gameRoutes);
app.use("/api/admin", adminRoutes);

/*
 * Spotify Login
 */
app.get("/api/spotify/login", (req, res) => {
  try {
    // Zufälligen State erzeugen
    spotifyOAuthState = crypto.randomBytes(32).toString("hex");

    const authUrl = getAuthorizationUrl(spotifyOAuthState);

    res.redirect(authUrl);
  } catch (err) {
    console.error("Spotify Login Fehler:", err);

    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>Spotify Fehler</title>
      </head>
      <body>
        <h1>Spotify Login konnte nicht gestartet werden</h1>
        <pre>${escapeHtml(err.message)}</pre>
      </body>
      </html>
    `);
  }
});

/*
 * Spotify Callback
 */
app.get("/api/spotify/callback", async (req, res) => {
  const { code, error, state } = req.query;

  // Benutzer hat Spotify abgebrochen
  if (error) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>Spotify abgebrochen</title>
      </head>
      <body>
        <h1>Spotify-Autorisierung abgebrochen</h1>
        <p>${escapeHtml(error)}</p>
        <p><a href="/admin.html">Zurück zum Admin-Bereich</a></p>
      </body>
      </html>
    `);
  }

  // Kein Code
  if (!code) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>Spotify Fehler</title>
      </head>
      <body>
        <h1>Spotify hat keinen Authorization Code geliefert.</h1>
        <p><a href="/admin.html">Zurück zum Admin-Bereich</a></p>
      </body>
      </html>
    `);
  }

  // OAuth State überprüfen
  if (!spotifyOAuthState || state !== spotifyOAuthState) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>Spotify Fehler</title>
      </head>
      <body>
        <h1>Ungültiger OAuth-State.</h1>
        <p>Bitte den Spotify-Login erneut starten.</p>
        <p><a href="/admin.html">Zurück zum Admin-Bereich</a></p>
      </body>
      </html>
    `);
  }

  // State nach erfolgreicher Prüfung löschen
  spotifyOAuthState = null;

  try {
    await exchangeCodeForTokens(code);

    res.send(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Spotify verbunden</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #111;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
          }

          .box {
            max-width: 500px;
            padding: 40px;
          }

          h1 {
            margin-bottom: 10px;
          }

          p {
            color: #aaa;
          }

          a {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 20px;
            background: #1ed760;
            color: black;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Spotify erfolgreich verbunden! ✓</h1>
          <p>Du kannst jetzt deine Spotify-Playlist importieren.</p>
          <a href="/admin.html">Zum Admin-Bereich</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Spotify OAuth Fehler:", err);

    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>Spotify Fehler</title>
      </head>
      <body>
        <h1>Spotify-Verbindung fehlgeschlagen</h1>
        <pre>${escapeHtml(err.message)}</pre>
        <p><a href="/admin.html">Zurück zum Admin-Bereich</a></p>
      </body>
      </html>
    `);
  }
});

/*
 * Kleiner HTML-Escape für Fehlermeldungen
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*
 * Server starten
 */
app.listen(PORT, () => {
  console.log(`Songless-Klon läuft auf Port ${PORT}`);
  console.log(`Admin-Bereich: /admin.html`);

  const pool = loadPool();

  if (pool.songs.length > 0) {
    console.log(`Song-Pool vorhanden: ${pool.songs.length} Songs`);
  } else {
    console.log(
      "Noch kein Song-Pool vorhanden. Bitte Spotify verbinden und Playlist importieren."
    );
  }
});
