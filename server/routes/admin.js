const express = require("express");
const { importPlaylist, loadConfig, loadPool } = require("../songPool");

const router = express.Router();

function requireAdminToken(req, res, next) {
  const token = req.header("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Ungueltiges Admin-Token." });
  }
  next();
}

router.get("/status", requireAdminToken, (req, res) => {
  const config = loadConfig();
  const pool = loadPool();
  res.json({
    playlistUrl: config.playlistUrl,
    lastImport: config.lastImport,
    songCount: pool.songs.length,
  });
});

router.post("/playlist", express.json(), requireAdminToken, async (req, res) => {
  const { playlistUrl } = req.body;
  if (!playlistUrl) {
    return res.status(400).json({ error: "playlistUrl fehlt." });
  }

  try {
    const result = await importPlaylist(playlistUrl);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
