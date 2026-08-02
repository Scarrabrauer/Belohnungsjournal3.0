# 🍫 Belohnungsjournal

Ein sehr einfaches Tool, um abendlichen Heißhunger zu tracken, Muster zu erkennen (z. B. wiederkehrende Auslöser) und daraus konkrete, bewusste Strategien abzuleiten. Ausgelegt fürs rückblickende Eintragen — das Datum steht standardmäßig auf gestern.

Neu in v3: komplette Neuentwicklung als **installierbare Web-App (PWA)** statt Streamlit — startet auf dem iPhone wie eine echte App, funktioniert offline, synchronisiert optional über dein eigenes GitHub-Repo.

## Features

- ✍️ **Eintragen**: Ergebnis / Auslöser / Strategie per Emoji-Chips, plus Szenario-Shortcuts, Datum (Standard: gestern, per ←/→ verschiebbar)
- 📚 **Verlauf**: alle Einträge, bearbeiten/löschen, Export als JSON/CSV, Import
- 📊 **Auswertung**: Kennzahlen pro Woche/Monat/gesamt, häufigste Auslöser, wirksamste Strategien, **regelbasierte Empfehlungen** (häufigster Auslöser, wirksamste Strategie, aktuelle Streak)
- ⚙️ **Einstellungen**: optionaler Cloud-Sync über die GitHub-API, Legende, Daten löschen

Alles läuft rein im Browser (kein Server, kein Build-Schritt) und funktioniert komplett offline — die Daten liegen lokal auf dem Gerät (`localStorage`) und werden bei Bedarf mit einer JSON-Datei in diesem Repo synchronisiert.

## Auf dem iPhone einrichten

1. App über GitHub Pages veröffentlichen (siehe unten) oder lokal öffnen.
2. Die Seite in **Safari** öffnen.
3. Unten auf **Teilen** tippen → **Zum Home-Bildschirm** → hinzufügen.
4. Ab jetzt startet die App per Icon wie eine normale App, auch im Flugmodus.

## Mit GitHub Pages veröffentlichen

1. In diesem Repo unter **Settings → Pages** als Quelle den Branch wählen, auf dem diese Dateien liegen (Ordner: `/ (root)`).
2. Die URL, die GitHub Pages ausgibt, ist deine App-URL — die auf dem iPhone öffnen und zum Home-Bildschirm hinzufügen.

## Lokal testen

Kein Build nötig, einfach über einen simplen Webserver ausliefern (`file://` funktioniert wegen ES-Modulen und Service Worker nicht zuverlässig):

```bash
python3 -m http.server 8000
# dann im Browser: http://localhost:8000
```

## Cloud-Sync einrichten (optional, für geräteübergreifenden Zugriff)

Ohne Sync bleiben die Daten lokal auf dem jeweiligen Gerät. Für Sync über mehrere Geräte hinweg wird ein GitHub **fine-grained Personal Access Token** verwendet, das nur dieses eine Repo mit **Contents: Read & Write** freischaltet:

1. [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) → Repository access: nur `Belohnungsjournal3.0` → Permissions: **Contents: Read and write**.
2. Token in der App unter **Einstellungen → Cloud-Sync** einfügen und speichern.
3. **Jetzt synchronisieren** tippen. Die Einträge landen als `data/entries.json` im Repo und werden bei jedem weiteren Sync gemergt (neuester Stand pro Eintrag gewinnt).

Der Token wird ausschließlich lokal auf dem Gerät gespeichert (`localStorage`) und nie ins Repo committet. App-Link daher nicht mit anderen teilen, solange ein Token hinterlegt ist.

## Warum die Empfehlungen regelbasiert statt KI-generiert sind

Bewusst offline-first und ohne API-Kosten gehalten: Die App erkennt feste Muster (häufigster Auslöser, wirksamste Strategie, aktuelle Streak) und verknüpft sie mit vordefinierten, evidenzbasierten Tipps. Das funktioniert überall sofort, ohne Internetverbindung.
