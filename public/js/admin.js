const form = document.getElementById("admin-form");
const tokenInput = document.getElementById("admin-token");
const urlInput = document.getElementById("playlist-url");
const submitBtn = document.getElementById("submit-btn");
const statusBox = document.getElementById("status-box");
const currentInfo = document.getElementById("current-info");

const TOKEN_KEY = "tageslied_admin_token";

tokenInput.value = localStorage.getItem(TOKEN_KEY) || "";

async function loadStatus() {
  const token = tokenInput.value.trim();
  if (!token) {
    currentInfo.textContent = "Admin-Token eingeben, um den aktuellen Stand zu sehen.";
    return;
  }
  try {
    const res = await fetch("/api/admin/status", {
      headers: { "x-admin-token": token },
    });
    if (!res.ok) {
      currentInfo.textContent = "Token ungueltig oder noch kein Import erfolgt.";
      return;
    }
    const data = await res.json();
    currentInfo.textContent = data.playlistUrl
      ? `Aktuelle Playlist: ${data.playlistUrl}\n${data.songCount} Songs im Pool \u00b7 letzter Import: ${new Date(data.lastImport).toLocaleString("de-DE")}`
      : "Noch keine Playlist importiert.";
    if (data.playlistUrl) urlInput.value = data.playlistUrl;
  } catch {
    currentInfo.textContent = "Server nicht erreichbar.";
  }
}

tokenInput.addEventListener("change", () => {
  localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
  loadStatus();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = tokenInput.value.trim();
  const playlistUrl = urlInput.value.trim();
  if (!token || !playlistUrl) return;

  localStorage.setItem(TOKEN_KEY, token);
  submitBtn.disabled = true;
  submitBtn.textContent = "Importiere... das kann eine Weile dauern";
  statusBox.classList.remove("visible");

  try {
    const res = await fetch("/api/admin/playlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ playlistUrl }),
    });
    const data = await res.json();

    statusBox.classList.add("visible");
    if (!res.ok) {
      statusBox.textContent = `Fehler: ${data.error}`;
    } else {
      let text = `Import erfolgreich!\n${data.matchedCount} von ${data.totalInPlaylist} Songs gefunden.`;
      if (data.unmatchedCount > 0) {
        text += `\n\n${data.unmatchedCount} Songs ohne Deezer-Treffer:\n`;
        text += data.unmatched.map((u) => `- ${u.title} - ${u.artist}`).join("\n");
      }
      statusBox.textContent = text;
      loadStatus();
    }
  } catch (err) {
    statusBox.classList.add("visible");
    statusBox.textContent = `Netzwerkfehler: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Playlist importieren";
  }
});

loadStatus();
