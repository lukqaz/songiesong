// Spotify OAuth + Playlist-Import
//
// Der Server verwendet Authorization Code Flow.
// Der Spotify-Access-Token wird für die Playlist-Abfrage verwendet.
// Spotify-Playlisten werden über /v1/playlists/{id}/items gelesen.

let accessToken = null;
let refreshToken = null;
let accessTokenExpiry = 0;

const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

function getConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET oder SPOTIFY_REDIRECT_URI fehlt."
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function getAuthorizationUrl(state) {
  const { clientId, redirectUri } = getConfig();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getConfig();

  const basic = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const res = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();

    throw new Error(
      `Spotify OAuth fehlgeschlagen (${res.status}): ${text}`
    );
  }

  const json = await res.json();

  accessToken = json.access_token;
  accessTokenExpiry =
    Date.now() + json.expires_in * 1000;

  if (json.refresh_token) {
    refreshToken = json.refresh_token;
  }

  return {
    expiresIn: json.expires_in,
  };
}

async function refreshAccessToken() {
  if (!refreshToken) {
    throw new Error(
      "Spotify ist noch nicht verbunden. Bitte zuerst mit Spotify verbinden."
    );
  }

  const { clientId, clientSecret } =
    getConfig();

  const basic = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const res = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();

    accessToken = null;
    refreshToken = null;
    accessTokenExpiry = 0;

    throw new Error(
      `Spotify Token konnte nicht erneuert werden (${res.status}): ${text}`
    );
  }

  const json = await res.json();

  accessToken = json.access_token;
  accessTokenExpiry =
    Date.now() + json.expires_in * 1000;

  // Spotify kann bei einem Refresh
  // einen neuen Refresh Token liefern.
  if (json.refresh_token) {
    refreshToken = json.refresh_token;
  }

  return accessToken;
}

async function getAccessToken() {
  if (
    accessToken &&
    Date.now() <
      accessTokenExpiry - 60_000
  ) {
    return accessToken;
  }

  return refreshAccessToken();
}

// Akzeptiert:
// https://open.spotify.com/playlist/ID
// spotify:playlist:ID
// nackte Playlist-ID
function extractPlaylistId(input) {
  if (!input) return null;

  const trimmed = input.trim();

  const urlMatch = trimmed.match(
    /playlist[/:]([a-zA-Z0-9]+)/
  );

  if (urlMatch) {
    return urlMatch[1].split("?")[0];
  }

  if (
    /^[a-zA-Z0-9]{18,24}$/.test(
      trimmed
    )
  ) {
    return trimmed;
  }

  return null;
}

// --------------------------------------------------
// Playlist Metadata
// --------------------------------------------------
//
// Holt Name, Cover und Gesamtzahl der Songs.
// Diese Daten werden später im Playlist-Balken
// unten im Spiel angezeigt.
// --------------------------------------------------

async function fetchPlaylistInfo(
  playlistId
) {
  const token =
    await getAccessToken();

  const url =
    `https://api.spotify.com/v1/playlists/${playlistId}` +
    `?fields=name,images,tracks(total)`;

  let res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    const newToken =
      await refreshAccessToken();

    res = await fetch(url, {
      headers: {
        Authorization:
          `Bearer ${newToken}`,
      },
    });
  }

  if (!res.ok) {
    const text =
      await res.text();

    throw new Error(
      `Spotify Playlist-Info konnte nicht geladen werden (${res.status}): ${text}`
    );
  }

  const json =
    await res.json();

  return {
    name:
      json.name ||
      "Playlist",

    iconUrl:
      json.images?.[0]?.url ||
      null,

    songCount:
      Number(
        json.tracks?.total
      ) || 0,
  };
}

// --------------------------------------------------
// Playlist Tracks
// --------------------------------------------------

async function fetchPlaylistTracks(
  playlistId
) {
  const token =
    await getAccessToken();

  const tracks = [];

  let url =
    `https://api.spotify.com/v1/playlists/${playlistId}/items` +
    `?limit=50` +
    `&fields=next,items(item(id,name,type,artists(name),album(name,images),preview_url))`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      // Access Token abgelaufen
      // -> einmal erneuern und erneut versuchen.
      const newToken =
        await refreshAccessToken();

      const retry = await fetch(
        url,
        {
          headers: {
            Authorization:
              `Bearer ${newToken}`,
          },
        }
      );

      if (!retry.ok) {
        const text =
          await retry.text();

        throw new Error(
          `Spotify Playlist-Abruf fehlgeschlagen (${retry.status}): ${text}`
        );
      }

      const json =
        await retry.json();

      for (const item of
        json.items || []) {
        const track =
          item.item;

        if (
          !track ||
          track.type !== "track" ||
          !track.id
        ) {
          continue;
        }

        tracks.push({
          spotifyId: track.id,
          title: track.name,

          artist:
            (track.artists || [])
              .map(
                (a) => a.name
              )
              .join(", "),

          album: track.album
            ? track.album.name
            : "",

          coverUrl:
            track.album?.images?.[0]
              ?.url || null,

          spotifyUrl:
            `https://open.spotify.com/track/${track.id}`,

          spotifyPreviewUrl:
            track.preview_url || null,
        });
      }

      url = json.next;
      continue;
    }

    if (!res.ok) {
      const text =
        await res.text();

      throw new Error(
        `Spotify Playlist-Abruf fehlgeschlagen (${res.status}): ${text}`
      );
    }

    const json =
      await res.json();

    for (const item of
      json.items || []) {
      const track =
        item.item;

      if (
        !track ||
        track.type !== "track" ||
        !track.id
      ) {
        continue;
      }

      tracks.push({
        spotifyId: track.id,
        title: track.name,

        artist:
          (track.artists || [])
            .map(
              (a) => a.name
            )
            .join(", "),

        album: track.album
          ? track.album.name
          : "",

        coverUrl:
          track.album?.images?.[0]
            ?.url || null,

        spotifyUrl:
          `https://open.spotify.com/track/${track.id}`,

        spotifyPreviewUrl:
          track.preview_url || null,
      });
    }

    url = json.next;
  }

  console.log(
    `Spotify: ${tracks.length} Tracks gefunden.`
  );

  return tracks;
}

function isSpotifyConnected() {
  return Boolean(
    accessToken ||
      refreshToken
  );
}

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getAccessToken,
  extractPlaylistId,
  fetchPlaylistInfo,
  fetchPlaylistTracks,
  isSpotifyConnected,
};
