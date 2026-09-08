// Liest nur oeffentliche Metadaten (Titel, Kuenstler, Cover) einer
// Spotify-Playlist aus. Keine Wiedergabe, keine Preview-URLs -
// dafuer wird Deezer genutzt (siehe deezer.js).

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry - 5000) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET fehlen in der .env Datei."
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify Auth fehlgeschlagen (${res.status}): ${text}`);
  }

  const json = await res.json();
  cachedToken = json.access_token;
  cachedTokenExpiry = now + json.expires_in * 1000;
  return cachedToken;
}

// Akzeptiert volle URLs, spotify:playlist:ID URIs oder die nackte ID.
function extractPlaylistId(input) {
  if (!input) return null;
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/playlist[/:]([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1].split("?")[0];

  if (/^[a-zA-Z0-9]{18,24}$/.test(trimmed)) return trimmed;

  return null;
}

async function fetchPlaylistTracks(playlistId) {
  const token = await getAccessToken();

  // Debug-Ausgaben
  console.log("Spotify Token vorhanden:", !!token);
  console.log("Spotify Playlist ID:", playlistId);

  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,name,artists(name),album(name,images)))`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();

      // Mehr Informationen zum tatsächlichen Spotify-Fehler
      console.error("Spotify API Fehler:");
      console.error("Status:", res.status);
      console.error("URL:", url);
      console.error("Antwort:", text);

      throw new Error(
        `Spotify Playlist-Abruf fehlgeschlagen (${res.status}): ${text}`
      );
    }

    const json = await res.json();

    for (const item of json.items || []) {
      const track = item.track;
      if (!track || !track.id) continue;

      tracks.push({
        spotifyId: track.id,
        title: track.name,
        artist: (track.artists || [])
          .map((a) => a.name)
          .join(", "),
        album: track.album ? track.album.name : "",
        coverUrl: track.album?.images?.[0]?.url || null,
        spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      });
    }

    url = json.next;
  }

  console.log(`Spotify: ${tracks.length} Tracks gefunden.`);

  return tracks;
}
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,name,artists(name),album(name,images)))`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify Playlist-Abruf fehlgeschlagen (${res.status}): ${text}`);
    }

    const json = await res.json();
    for (const item of json.items || []) {
      const track = item.track;
      if (!track || !track.id) continue;
      tracks.push({
        spotifyId: track.id,
        title: track.name,
        artist: (track.artists || []).map((a) => a.name).join(", "),
        album: track.album ? track.album.name : "",
        coverUrl: track.album?.images?.[0]?.url || null,
        spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      });
    }
    url = json.next;
  }

  return tracks;
}

module.exports = { getAccessToken, extractPlaylistId, fetchPlaylistTracks };
