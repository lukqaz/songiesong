const form =
  document.getElementById("admin-form");

const tokenInput =
  document.getElementById("admin-token");

const urlInput =
  document.getElementById("playlist-url");

const submitBtn =
  document.getElementById("submit-btn");

const statusBox =
  document.getElementById("status-box");

const currentInfo =
  document.getElementById("current-info");

const statusIndicator =
  document.getElementById("status-indicator");

const spotifyBtn =
  document.querySelector(".spotify-btn");

const spotifyTitle =
  document.querySelector(".spotify-title");

const spotifyDescription =
  document.querySelector(
    ".spotify-description"
  );

const TOKEN_KEY =
  "tageslied_admin_token";

// --------------------------------------------------
// Session Token
// --------------------------------------------------

tokenInput.value =
  sessionStorage.getItem(TOKEN_KEY) || "";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function saveToken() {
  const token =
    tokenInput.value.trim();

  if (token) {
    sessionStorage.setItem(
      TOKEN_KEY,
      token
    );
  } else {
    sessionStorage.removeItem(
      TOKEN_KEY
    );
  }
}

function setStatusIndicator(
  active
) {
  if (!statusIndicator) return;

  statusIndicator.style.background =
    active
      ? "var(--green)"
      : "var(--text-muted)";

  statusIndicator.style.boxShadow =
    active
      ? "0 0 0 4px rgba(52, 224, 138, 0.08), 0 0 16px rgba(52, 224, 138, 0.35)"
      : "none";
}

function showStatus(
  text,
  type = ""
) {
  statusBox.textContent =
    text;

  statusBox.classList.add(
    "visible"
  );

  statusBox.classList.remove(
    "success",
    "error"
  );

  if (type) {
    statusBox.classList.add(
      type
    );
  }
}

// --------------------------------------------------
// Spotify connection UI
// --------------------------------------------------

function setSpotifyStatus(
  connected
) {
  if (
    !spotifyBtn ||
    !spotifyTitle ||
    !spotifyDescription
  ) {
    return;
  }

  if (connected) {
    spotifyBtn.textContent =
      "Spotify Connected";

    spotifyBtn.classList.add(
      "spotify-connected"
    );

    spotifyTitle.textContent =
      "Spotify Connected";

    spotifyDescription.textContent =
      "Your Spotify account is connected. You can now import playlists into the song pool.";
  } else {
    spotifyBtn.textContent =
      "Connect with Spotify";

    spotifyBtn.classList.remove(
      "spotify-connected"
    );

    spotifyTitle.textContent =
      "Connect Spotify";

    spotifyDescription.textContent =
      "Connect your Spotify account to access and import one of your playlists into the song pool.";
  }
}

// --------------------------------------------------
// Current status
// --------------------------------------------------

async function loadStatus() {
  const token =
    tokenInput.value.trim();

  if (!token) {
    currentInfo.textContent =
      "Enter your admin token to view the current status.";

    setStatusIndicator(false);

    setSpotifyStatus(false);

    return;
  }

  try {
    const res =
      await fetch(
        "/api/admin/status",
        {
          headers: {
            "x-admin-token":
              token,
          },
          cache: "no-store",
        }
      );

    if (!res.ok) {
      currentInfo.textContent =
        "Invalid token or no playlist imported yet.";

      setStatusIndicator(false);

      setSpotifyStatus(false);

      return;
    }

    const data =
      await res.json();

    setStatusIndicator(true);

    setSpotifyStatus(
      Boolean(
        data.spotifyConnected
      )
    );

    if (data.playlistUrl) {
      const lastImport =
        data.lastImport
          ? new Date(
              data.lastImport
            ).toLocaleString(
              "de-DE"
            )
          : "—";

      currentInfo.textContent =
        `Playlist: ${data.playlistUrl}\n` +
        `${data.songCount} songs in pool · ` +
        `last import: ${lastImport}`;

      urlInput.value =
        data.playlistUrl;
    } else {
      currentInfo.textContent =
        "No playlist imported yet.";
    }
  } catch (error) {
    console.error(
      "Status error:",
      error
    );

    currentInfo.textContent =
      "Server unreachable.";

    setStatusIndicator(false);

    setSpotifyStatus(false);
  }
}

// --------------------------------------------------
// Token change
// --------------------------------------------------

tokenInput.addEventListener(
  "change",
  () => {
    saveToken();
    loadStatus();
  }
);

tokenInput.addEventListener(
  "input",
  () => {
    saveToken();
  }
);

// --------------------------------------------------
// Playlist import
// --------------------------------------------------

form.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const token =
      tokenInput.value.trim();

    const playlistUrl =
      urlInput.value.trim();

    if (!token) {
      showStatus(
        "Error: Please enter your admin token.",
        "error"
      );

      tokenInput.focus();

      return;
    }

    if (!playlistUrl) {
      showStatus(
        "Error: Please enter a Spotify playlist URL.",
        "error"
      );

      urlInput.focus();

      return;
    }

    saveToken();

    submitBtn.disabled = true;

    submitBtn.textContent =
      "Importing playlist…";

    statusBox.classList.remove(
      "visible",
      "success",
      "error"
    );

    try {
      const res =
        await fetch(
          "/api/admin/playlist",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-admin-token":
                token,
            },

            body: JSON.stringify({
              playlistUrl,
            }),
          }
        );

      const data =
        await res.json()
          .catch(
            () => ({})
          );

      if (!res.ok) {
        showStatus(
          `Error: ${
            data.error ||
            "Import failed."
          }`,
          "error"
        );

        return;
      }

      let text =
        "Import successful!\n\n" +
        `${data.matchedCount} of ` +
        `${data.totalInPlaylist} songs matched.`;

      if (
        data.unmatchedCount > 0
      ) {
        text +=
          `\n\n${data.unmatchedCount} songs without a Deezer match:\n`;

        text +=
          data.unmatched
            .map(
              (song) =>
                `- ${song.title} - ${song.artist}`
            )
            .join("\n");
      }

      showStatus(
        text,
        "success"
      );

      await loadStatus();
    } catch (error) {
      console.error(
        "Import error:",
        error
      );

      showStatus(
        `Network error: ${error.message}`,
        "error"
      );
    } finally {
      submitBtn.disabled =
        false;

      submitBtn.textContent =
        "Import playlist";
    }
  }
);

// --------------------------------------------------
// Start
// --------------------------------------------------

setSpotifyStatus(false);

loadStatus();
