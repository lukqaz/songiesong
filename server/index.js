const crypto = require("crypto");

const {
  getAuthorizationUrl,
  exchangeCodeForTokens,
} = require("./spotify");

require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");

const gameRoutes = require("./routes/game");
const adminRoutes = require("./routes/admin");
const { importPlaylist, loadPool } = require("./songPool");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api/game", gameRoutes);
app.use("/api/admin", adminRoutes);

async function maybeImportDefaultPlaylist() {
  const pool = loadPool();
  if (pool.songs.length > 0) return; // schon ein Pool vorhanden

  const defaultUrl = process.env.DEFAULT_PLAYLIST_URL;
  if (!defaultUrl) {
    console.log(
      "Kein Song-Pool vorhanden. Bitte unter /admin.html eine Spotify-Playlist importieren."
    );
    return;
  }

  console.log(`Importiere Standard-Playlist: ${defaultUrl}`);
  try {
    const result = await importPlaylist(defaultUrl);
    console.log(
      `Import fertig: ${result.matchedCount} Songs gefunden, ${result.unmatchedCount} nicht gematcht.`
    );
  } catch (err) {
    console.error("Import der Standard-Playlist fehlgeschlagen:", err.message);
  }
}

app.get("/api/spotify/login", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = getAuthorizationUrl(state);

  res.redirect(authUrl);
});

app.get("/api/spotify/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(
      `Spotify-Autorisierung abgebrochen: ${error}`
    );
  }

  if (!code) {
    return res.status(400).send(
      "Spotify hat keinen Authorization Code geliefert."
    );
  }

  try {
    await exchangeCodeForTokens(code);

    res.send(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>Spotify verbunden</title>
      </head>
      <body>
        <h1>Spotify erfolgreich verbunden!</h1>
        <p>Du kannst dieses Fenster schließen und zur Admin-Seite zurückkehren.</p>
        <script>
          setTimeout(() => {
            window.location.href = "/admin.html";
          }, 1500);
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Spotify OAuth Fehler:", err);

    res.status(500).send(`
      <h1>Spotify-Verbindung fehlgeschlagen</h1>
      <pre>${String(err.message).replace(/</g, "&lt;")}</pre>
    `);
  }
});

app.listen(PORT, async () => {
  console.log(`Songless-Klon laeuft auf http://localhost:${PORT}`);
  console.log(`Admin-Bereich: http://localhost:${PORT}/admin.html`);
  await maybeImportDefaultPlaylist();
});
