// Oeffentliche Deezer-Suche, keine Authentifizierung noetig.
// Liefert 30-Sekunden-Preview-MP3s fuer den Spielbetrieb.

const { scoreCandidate, MATCH_THRESHOLD } = require("./matching");

async function searchDeezerCandidates(title, artist) {
  const advancedQuery = `track:"${title}" artist:"${artist}"`;
  let candidates = await runSearch(advancedQuery);

  if (candidates.length === 0) {
    // Fallback: einfache Volltextsuche, falls die praezise Query nichts findet
    candidates = await runSearch(`${title} ${artist}`);
  }

  return candidates;
}

async function runSearch(query) {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || [])
    .filter((t) => t.preview) // nur Treffer mit tatsaechlicher Preview
    .map((t) => ({
      deezerId: t.id,
      title: t.title,
      artist: t.artist?.name || "",
      previewUrl: t.preview,
      albumCover: t.album?.cover_medium || null,
    }));
}

// Findet den besten Deezer-Treffer fuer einen Spotify-Track.
// Gibt null zurueck, wenn keine ausreichend sichere Uebereinstimmung existiert.
async function findBestMatch(spotifyTrack) {
  const candidates = await searchDeezerCandidates(
    spotifyTrack.title,
    spotifyTrack.artist
  );

  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreCandidate(spotifyTrack, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (best && bestScore >= MATCH_THRESHOLD) {
    return { ...best, matchScore: bestScore };
  }
  return null;
}

module.exports = { findBestMatch };
