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

app.listen(PORT, async () => {
  console.log(`Songless-Klon laeuft auf http://localhost:${PORT}`);
  console.log(`Admin-Bereich: http://localhost:${PORT}/admin.html`);
  await maybeImportDefaultPlaylist();
});
