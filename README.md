# Tageslied — ein Songless/Heardle-Klon

Errate taeglich einen Song anhand eines wachsenden Audio-Ausschnitts.
Die Songauswahl kommt aus einer beliebigen **oeffentlichen Spotify-Playlist**,
die Audio-Vorschauen werden ueber die **Deezer-API** abgespielt (Spotify liefert
seit Ende 2024 keine nutzbaren Preview-URLs mehr fuer Drittanbieter-Apps).

## Funktionsweise

1. Du gibst im Admin-Bereich (`/admin.html`) einen Spotify-Playlist-Link ein.
2. Der Server liest die Tracks der Playlist aus (Titel, Kuenstler, Cover).
3. Fuer jeden Track wird bei Deezer nach einem passenden 30-Sekunden-Preview
   gesucht (Titel + Kuenstler werden normalisiert und per Aehnlichkeits-Score
   gematcht, siehe `server/matching.js`).
4. Alle erfolgreich gematchten Songs bilden den Song-Pool (`data/songs.json`).
5. Jeden Tag wird deterministisch ein neuer Song aus dem Pool gewaehlt
   (jeder Song kommt einmal dran, bevor sich der Zyklus wiederholt).
6. Im Spiel selbst wird zur Laufzeit **nicht mehr auf Spotify zugegriffen** —
   nur noch auf die gespeicherte Deezer-Preview-URL.

## Setup

```bash
npm install
cp .env.example .env
```

Trage in `.env` ein:

- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` — aus einer eigenen App im
  [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
  "Client Credentials Flow" reicht aus, es ist kein Redirect-URI-Setup fuer
  Nutzer-Login noetig, da nur oeffentliche Playlist-Daten gelesen werden.
- `ADMIN_TOKEN` — ein selbst gewaehltes Passwort fuer die Admin-Seite.
- optional `DEFAULT_PLAYLIST_URL` — wird beim allerersten Start automatisch
  importiert, falls noch kein Song-Pool existiert.

Server starten:

```bash
npm start
```

Dann:

- Spiel: `http://localhost:3000`
- Admin (Playlist aendern): `http://localhost:3000/admin.html`

## Playlist spaeter aendern

Auf `/admin.html` Admin-Token eingeben, neuen Playlist-Link einfuegen,
"Playlist importieren" klicken. Der komplette Song-Pool wird ersetzt und die
Tages-Rotation beginnt neu mit den frisch importierten Songs.

## Wichtige Einschraenkungen

- **Nicht jeder Song wird gefunden.** Manche Tracks existieren nicht bei
  Deezer oder nur in einer anderen Version. Nach jedem Import zeigt die
  Admin-Seite an, welche Songs nicht gematcht werden konnten — die landen
  einfach nicht im Spiel-Pool.
- **Deezer-Previews starten nicht zwingend bei Sekunde 0** des Songs,
  sondern an einer vom Anbieter festgelegten Stelle (meist der Refrain).
  Ein Modus mit Wiedergabe ab dem echten Songanfang waere nur ueber das
  Spotify Web Playback SDK moeglich und wuerde einen Spotify-Premium-Login
  jedes Spielers voraussetzen — das ist hier bewusst nicht eingebaut, kann
  aber bei Bedarf ergaenzt werden.
- Die Admin-Seite ist nur durch ein einfaches Token geschuetzt. Fuer einen
  oeffentlichen Produktiv-Einsatz mit mehreren Admins wuerde man das durch
  ein echtes Login-System ersetzen.
- Songdaten liegen als einfache JSON-Datei (`data/songs.json`), es gibt
  keine Datenbank. Fuer eine kleine bis mittlere Playlist reicht das aus.

## Projektstruktur

```
server/
  index.js          Express-Server, Startpunkt
  spotify.js        Playlist-Metadaten von Spotify lesen
  deezer.js         Preview-URLs von Deezer suchen/matchen
  matching.js        Titel/Kuenstler normalisieren & Aehnlichkeit berechnen
  songPool.js       Song-Pool verwalten, taeglichen Song bestimmen
  routes/
    game.js         API fuers Spiel (heutiger Song, Autocomplete, Guess)
    admin.js        API fuer Playlist-Import
public/
  index.html/css/js Spieloberflaeche
  admin.html/js     Admin-Oberflaeche
data/
  songs.json        generierter Song-Pool (entsteht beim ersten Import)
  config.json       aktuell eingestellter Playlist-Link
```

## Moegliche naechste Schritte

- Statistiken/Streaks pro Nutzer (z.B. per Cookie oder Login)
- "Teilen"-Funktion mit Emoji-Grid wie bei Wordle
- Mehrere Playlists/Kategorien zur Auswahl (z.B. "80er", "Deutschrap")
- Rate-Limit fuer die Guess-Route gegen Bruteforce-Raten
