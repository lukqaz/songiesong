// Normalisiert und vergleicht Songtitel/Kuenstler, um Spotify-Tracks
// mit den passenden Deezer-Treffern zu matchen.

function normalize(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Akzente entfernen
    .replace(/\(.*?\)|\[.*?\]/g, " ") // Klammerzusaetze entfernen
    .replace(/\b(feat|ft|featuring)\b.*$/g, " ") // Feat.-Angaben abschneiden
    .replace(/\b(remaster(ed)?|radio edit|live|mono|stereo|version|single|album)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ") // Sonderzeichen entfernen
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(str) {
  return new Set(normalize(str).split(" ").filter(Boolean));
}

// Dice-Koeffizient ueber die Wort-Mengen zweier Strings (0..1)
function similarity(a, b) {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const tok of setA) {
    if (setB.has(tok)) overlap++;
  }
  return (2 * overlap) / (setA.size + setB.size);
}

// Bewertet, wie gut ein Deezer-Treffer zu einem Spotify-Track passt.
function scoreCandidate(spotifyTrack, deezerTrack) {
  const titleScore = similarity(spotifyTrack.title, deezerTrack.title);
  const artistScore = similarity(spotifyTrack.artist, deezerTrack.artist);
  // Titel zaehlt am meisten, Kuenstler bestaetigt den Treffer
  return titleScore * 0.7 + artistScore * 0.3;
}

// Wie sicher muss ein Match mindestens sein, um uebernommen zu werden
const MATCH_THRESHOLD = 0.55;

module.exports = { normalize, similarity, scoreCandidate, MATCH_THRESHOLD };
