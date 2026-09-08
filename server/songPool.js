const fs = require("fs");
const path = require("path");

const {
  extractPlaylistId,
  fetchPlaylistInfo,
  fetchPlaylistTracks,
} = require("./spotify");

const {
  findBestMatch,
} = require("./deezer");

const DATA_DIR = path.join(
  __dirname,
  "..",
  "data"
);

const SONGS_PATH = path.join(
  DATA_DIR,
  "songs.json"
);

const CONFIG_PATH = path.join(
  DATA_DIR,
  "config.json"
);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, {
    recursive: true,
  });
}

function readJson(
  filePath,
  fallback
) {
  try {
    return JSON.parse(
      fs.readFileSync(
        filePath,
        "utf8"
      )
    );
  } catch {
    return fallback;
  }
}

function writeJson(
  filePath,
  data
) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );
}

function loadPool() {
  return readJson(
    SONGS_PATH,
    {
      songs: [],
      order: [],
      importedAt: null,
    }
  );
}

function loadConfig() {
  return readJson(
    CONFIG_PATH,
    {
      playlistUrl: null,
      playlistName: null,
      playlistIconUrl: null,
      playlistSongCount: 0,
      lastImport: null,
    }
  );
}

// Deterministischer Pseudo-Zufall
// (mulberry32), damit die Reihenfolge
// bei jedem Import gleich bleibt,
// bis neu importiert wird.
function seededShuffle(
  array,
  seed
) {
  const result = [...array];

  let a = seed;

  function random() {
    a |= 0;

    a =
      (a + 0x6d2b79f5) |
      0;

    let t = Math.imul(
      a ^ (a >>> 15),
      1 | a
    );

    t =
      (t +
        Math.imul(
          t ^ (t >>> 7),
          61 | t
        )) ^
      t;

    return (
      (t ^ (t >>> 14)) >>>
      0
    ) / 4294967296;
  }

  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {
    const j = Math.floor(
      random() * (i + 1)
    );

    [
      result[i],
      result[j],
    ] = [
      result[j],
      result[i],
    ];
  }

  return result;
}

function hashStringToInt(
  str
) {
  let hash = 0;

  for (
    let i = 0;
    i < str.length;
    i++
  ) {
    hash =
      (hash << 5) -
      hash +
      str.charCodeAt(i);

    hash |= 0;
  }

  return hash;
}

async function importPlaylist(
  playlistUrl
) {
  const playlistId =
    extractPlaylistId(
      playlistUrl
    );

  if (!playlistId) {
    throw new Error(
      "Konnte keine gueltige Spotify-Playlist-ID aus dem Link lesen."
    );
  }

  // --------------------------------------------------
  // Playlist-Informationen
  // --------------------------------------------------

  const playlistInfo =
    await fetchPlaylistInfo(
      playlistId
    );

  // --------------------------------------------------
  // Playlist-Tracks
  // --------------------------------------------------

  const spotifyTracks =
    await fetchPlaylistTracks(
      playlistId
    );

  if (
    spotifyTracks.length === 0
  ) {
    throw new Error(
      "Die Playlist enthaelt keine Tracks oder ist nicht oeffentlich."
    );
  }

  const matched = [];
  const unmatched = [];

  for (const track of
    spotifyTracks) {
    const deezerMatch =
      await findBestMatch(
        track
      );

    if (deezerMatch) {
      matched.push({
        id: `${track.spotifyId}`,

        title:
          track.title,

        artist:
          track.artist,

        coverUrl:
          track.coverUrl ||
          deezerMatch.albumCover,

        spotifyUrl:
          track.spotifyUrl,

        // Spotify Preview wird
        // fuer Main Hook verwendet.
        spotifyPreviewUrl:
          track.spotifyPreviewUrl ||
          null,

        // Deezer bleibt der
        // Fallback bzw. From-Beginning-Preview.
        previewUrl:
          deezerMatch.previewUrl,

        matchScore:
          Number(
            deezerMatch.matchScore.toFixed(
              2
            )
          ),
      });
    } else {
      unmatched.push({
        title:
          track.title,
        artist:
          track.artist,
      });
    }
  }

  if (matched.length < 3) {
    throw new Error(
      `Nur ${matched.length} Songs konnten bei Deezer gefunden werden. ` +
        `Das reicht nicht zum Spielen - bitte eine andere Playlist versuchen.`
    );
  }

  const seed =
    hashStringToInt(
      playlistId
    );

  const order =
    seededShuffle(
      matched.map(
        (s) => s.id
      ),
      seed
    );

  // --------------------------------------------------
  // Songs speichern
  // --------------------------------------------------

  writeJson(
    SONGS_PATH,
    {
      songs: matched,
      order,
      importedAt:
        new Date().toISOString(),
    }
  );

  // --------------------------------------------------
  // Playlist-Informationen speichern
  // --------------------------------------------------

  writeJson(
    CONFIG_PATH,
    {
      playlistUrl,

      playlistName:
        playlistInfo.name,

      playlistIconUrl:
        playlistInfo.iconUrl,

      playlistSongCount:
        playlistInfo.songCount,

      lastImport:
        new Date().toISOString(),
    }
  );

  return {
    totalInPlaylist:
      spotifyTracks.length,

    matchedCount:
      matched.length,

    unmatchedCount:
      unmatched.length,

    unmatched,

    playlistName:
      playlistInfo.name,

    playlistIconUrl:
      playlistInfo.iconUrl,

    playlistSongCount:
      playlistInfo.songCount,
  };
}

function daysSinceEpoch(
  date
) {
  return Math.floor(
    date.getTime() /
      86400000
  );
}

// Waehlt den "Song des Tages"
// deterministisch aus der gespeicherten
// Reihenfolge.
//
// Daily wird aktuell nicht vom
// normalen Spielmodus verwendet.
function getDailySong(
  pool,
  date = new Date()
) {
  if (
    !pool.order ||
    pool.order.length === 0
  ) {
    return null;
  }

  const index =
    daysSinceEpoch(date) %
    pool.order.length;

  const songId =
    pool.order[index];

  return (
    pool.songs.find(
      (s) =>
        s.id === songId
    ) || null
  );
}

function getPublicSongList(
  pool
) {
  // Fuer die Autocomplete-Suche
  // im Frontend: keine Preview-URLs.
  return pool.songs.map(
    (s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
    })
  );
}

module.exports = {
  loadPool,
  loadConfig,
  importPlaylist,
  getDailySong,
  getPublicSongList,
};
