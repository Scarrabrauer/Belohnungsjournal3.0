import {
  RESULTS, TRIGGERS, STRATEGIES, SCENARIOS,
  loadEntries, saveEntries, upsertEntry, deleteEntry, mergeEntries,
  makeEntry, formatEntryLine, formatDateDE, todayISO, nowHM,
} from "./data.js";
import {
  filterByPeriod, computeStats, successRate, buildRecommendations,
} from "./analysis.js";
import {
  loadSyncConfig, saveSyncConfig, fetchRemoteFile, putRemoteFile,
  isConfigured, testConnection,
} from "./sync.js";

const state = {
  entries: loadEntries(),
  tab: "log",
  reportPeriod: "week",
  form: {
    editingId: null,
    date: todayISO(),
    time: nowHM(),
    results: [],
    triggers: [],
    strategies: [],
    scenario: "— Manuell auswählen —",
    note: "",
  },
  syncing: false,
};

const main = document.getElementById("main");
const toastEl = document.getElementById("toast");
let toastTimer = null;

function toast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle("error", isError);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.toggleAttribute("aria-current", active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
  render();
}

document.getElementById("bottom-nav").addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn");
  if (btn) switchTab(btn.dataset.tab);
});

function resetForm() {
  state.form = {
    editingId: null,
    date: todayISO(),
    time: nowHM(),
    results: [],
    triggers: [],
    strategies: [],
    scenario: "— Manuell auswählen —",
    note: "",
  };
}

function chipGroup(dict, selectedList, groupKey, max) {
  return `<div class="chip-group" data-group="${groupKey}">${Object.entries(dict)
    .map(([emoji, label]) => {
      const selected = selectedList.includes(emoji);
      return `<button type="button" class="chip${selected ? " selected" : ""}" data-emoji="${emoji}" data-group="${groupKey}">
        <span>${emoji}</span><span class="label">${label}</span>
      </button>`;
    })
    .join("")}</div>`;
}

function previewLine() {
  const f = state.form;
  if (!f.results.length) return "";
  return formatEntryLine({
    date: f.date, time: f.time, results: f.results,
    triggers: f.triggers, strategies: f.strategies, note: f.note,
  });
}

function renderLog() {
  const f = state.form;
  main.innerHTML = `
    <h2>Datum & Uhrzeit</h2>
    <div class="card">
      <div class="row" style="margin-bottom:8px;">
        <div style="flex:1;">
          <label class="field-label">Datum</label>
          <input type="date" id="f-date" value="${f.date}" />
        </div>
        <div style="flex:1;">
          <label class="field-label">Uhrzeit</label>
          <input type="time" id="f-time" value="${f.time}" />
        </div>
      </div>
      <button type="button" class="btn btn-secondary" id="btn-now">🕗 Jetzt</button>
    </div>

    <h2>Szenario-Shortcut</h2>
    <div class="card">
      <select id="f-scenario">
        ${Object.keys(SCENARIOS).map((name) => `<option value="${name}" ${name === f.scenario ? "selected" : ""}>${name}</option>`).join("")}
      </select>
      <p class="small-note" style="margin-top:8px;">Füllt Ergebnis, Auslöser und Strategie automatisch — danach frei anpassbar.</p>
    </div>

    <h2>1. Ergebnis <span style="text-transform:none;font-weight:400;">(max. 2)</span></h2>
    <div class="card">${chipGroup(RESULTS, f.results, "results", 2)}</div>

    <h2>2. Auslöser <span style="text-transform:none;font-weight:400;">(optional, max. 2)</span></h2>
    <div class="card">${chipGroup(TRIGGERS, f.triggers, "triggers", 2)}</div>

    <h2>3. Strategie <span style="text-transform:none;font-weight:400;">(optional, max. 2)</span></h2>
    <div class="card">${chipGroup(STRATEGIES, f.strategies, "strategies", 2)}</div>

    <h2>Notiz <span style="text-transform:none;font-weight:400;">(optional)</span></h2>
    <div class="card">
      <input type="text" id="f-note" placeholder="z. B. besonders stressiger Tag" value="${escapeAttr(f.note)}" />
    </div>

    <div class="preview-line">${previewLine() || "Wähle mindestens ein Ergebnis aus…"}</div>

    <div class="btn-row">
      <button type="button" class="btn btn-primary" id="btn-save">${f.editingId ? "💾 Änderung speichern" : "💾 Eintrag speichern"}</button>
    </div>
    <div class="btn-row">
      <button type="button" class="btn btn-secondary" id="btn-reset">↺ Zurücksetzen</button>
    </div>
  `;

  document.getElementById("f-date").addEventListener("change", (e) => {
    state.form.date = e.target.value;
    renderLog();
  });
  document.getElementById("f-time").addEventListener("change", (e) => {
    state.form.time = e.target.value;
    renderLog();
  });
  document.getElementById("btn-now").addEventListener("click", () => {
    state.form.date = todayISO();
    state.form.time = nowHM();
    renderLog();
  });
  document.getElementById("f-scenario").addEventListener("change", (e) => {
    const preset = SCENARIOS[e.target.value];
    state.form.scenario = e.target.value;
    if (preset) {
      state.form.results = [...preset.results];
      state.form.triggers = [...preset.triggers];
      state.form.strategies = [...preset.strategies];
    }
    renderLog();
  });
  document.getElementById("f-note").addEventListener("input", (e) => {
    state.form.note = e.target.value;
  });
  main.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const group = chip.dataset.group;
      const emoji = chip.dataset.emoji;
      const list = state.form[group];
      const idx = list.indexOf(emoji);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        if (list.length >= 2) list.shift();
        list.push(emoji);
      }
      renderLog();
    });
  });
  document.getElementById("btn-save").addEventListener("click", saveCurrentEntry);
  document.getElementById("btn-reset").addEventListener("click", () => {
    resetForm();
    renderLog();
  });
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function saveCurrentEntry() {
  const f = state.form;
  if (!f.results.length) {
    toast("Bitte mindestens ein Ergebnis auswählen.", true);
    return;
  }
  const entry = makeEntry({
    id: f.editingId,
    date: f.date, time: f.time,
    results: f.results, triggers: f.triggers, strategies: f.strategies,
    scenario: f.scenario === "— Manuell auswählen —" ? "" : f.scenario,
    note: f.note,
  });
  state.entries = upsertEntry([...state.entries], entry);
  saveEntries(state.entries);
  toast(f.editingId ? "Eintrag aktualisiert." : "Gespeichert — bewusster Check-in erledigt. 💚");
  resetForm();
  renderLog();
  maybeAutoSync();
}

function renderHistory() {
  const sorted = [...state.entries].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  const byDate = new Map();
  for (const e of sorted) {
    const list = byDate.get(e.date) || [];
    list.push(e);
    byDate.set(e.date, list);
  }

  let listHtml = "";
  if (!sorted.length) {
    listHtml = `<div class="empty-state">Noch keine Einträge. Leg auf „Eintragen" los.</div>`;
  } else {
    listHtml = Array.from(byDate.entries())
      .map(([date, dayEntries]) => `
        <div class="history-day">
          <h3>${formatDateDE(date)}</h3>
          ${dayEntries.map((e) => `
            <div class="history-entry" data-id="${e.id}">
              <div>
                <div class="entry-time">${e.time || ""}</div>
                <div class="entry-text">${escapeHtml(formatEntryLine(e).replace(`${formatDateDE(e.date)} ${e.time} `, ""))}</div>
              </div>
              <div class="entry-actions">
                <button type="button" class="btn-edit" title="Bearbeiten">✏️</button>
                <button type="button" class="btn-delete" title="Löschen">🗑️</button>
              </div>
            </div>
          `).join("")}
        </div>
      `).join("");
  }

  main.innerHTML = `
    <h2>Verlauf (${sorted.length})</h2>
    ${listHtml}

    <h2>Sichern & Übertragen</h2>
    <div class="card">
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" id="btn-export-json">⬇️ Als JSON</button>
        <button type="button" class="btn btn-secondary" id="btn-export-csv">⬇️ Als CSV</button>
      </div>
      <div class="btn-row">
        <label class="btn btn-secondary" style="cursor:pointer;">
          ⬆️ JSON importieren
          <input type="file" id="import-file" accept="application/json" style="display:none;" />
        </label>
      </div>
      <p class="small-note" style="margin-top:8px;">Für automatische Cloud-Sicherung siehe Einstellungen → Cloud-Sync.</p>
    </div>
  `;

  main.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".history-entry").dataset.id;
      const entry = state.entries.find((e) => e.id === id);
      if (!entry) return;
      state.form = {
        editingId: entry.id,
        date: entry.date,
        time: entry.time,
        results: [...entry.results],
        triggers: [...entry.triggers],
        strategies: [...entry.strategies],
        scenario: entry.scenario || "— Manuell auswählen —",
        note: entry.note || "",
      };
      switchTab("log");
    });
  });
  main.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".history-entry").dataset.id;
      if (!confirm("Diesen Eintrag wirklich löschen?")) return;
      state.entries = deleteEntry(state.entries, id);
      saveEntries(state.entries);
      renderHistory();
      maybeAutoSync();
    });
  });
  document.getElementById("btn-export-json")?.addEventListener("click", () => {
    downloadFile("belohnungsjournal.json", JSON.stringify(state.entries, null, 2), "application/json");
  });
  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    downloadFile("belohnungsjournal.csv", toCsv(state.entries), "text/csv");
  });
  document.getElementById("import-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) throw new Error("Kein gültiges Format.");
      state.entries = mergeEntries(state.entries, imported);
      saveEntries(state.entries);
      toast(`${imported.length} Einträge importiert/gemergt.`);
      renderHistory();
    } catch (err) {
      toast("Import fehlgeschlagen: " + err.message, true);
    }
  });
}

function toCsv(entries) {
  const header = "Datum;Uhrzeit;Ergebnis;Ausloeser;Strategie;Notiz";
  const rows = entries
    .slice()
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
    .map((e) => [formatDateDE(e.date), e.time, e.results.join(""), e.triggers.join(""), e.strategies.join(""), (e.note || "").replace(/;/g, ",")].join(";"));
  return [header, ...rows].join("\n");
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function barList(dict, counts) {
  const entries = Object.entries(dict)
    .map(([emoji, label]) => ({ emoji, label, count: counts[emoji] || 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  if (!entries.length) return `<p class="small-note">Noch keine Daten für diesen Zeitraum.</p>`;
  const max = Math.max(...entries.map((x) => x.count));
  return `<div class="bar-list">${entries
    .map(
      (x) => `<div class="bar-row">
        <span>${x.emoji}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.round((x.count / max) * 100)}%"></span></span>
        <span>${x.count}</span>
      </div>`
    )
    .join("")}</div>`;
}

function renderReport() {
  const filtered = filterByPeriod(state.entries, state.reportPeriod);
  const stats = computeStats(filtered);
  const rate = successRate(filtered);
  const rec = buildRecommendations(state.entries, state.reportPeriod);

  main.innerHTML = `
    <h2>Zeitraum</h2>
    <div class="segmented">
      <button data-period="week" class="${state.reportPeriod === "week" ? "active" : ""}">Diese Woche</button>
      <button data-period="month" class="${state.reportPeriod === "month" ? "active" : ""}">Dieser Monat</button>
      <button data-period="all" class="${state.reportPeriod === "all" ? "active" : ""}">Gesamt</button>
    </div>

    ${filtered.length === 0 ? `<div class="empty-state">Für diesen Zeitraum gibt es noch keine Einträge.</div>` : `
    <h2>Überblick</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value">${stats.results["🟢"]}</div><div class="kpi-label">🟢 bewusst</div></div>
      <div class="kpi"><div class="kpi-value">${stats.results["⭐"]}</div><div class="kpi-label">⭐ ohne Heißhunger</div></div>
      <div class="kpi"><div class="kpi-value">${stats.results["🔴"]}</div><div class="kpi-label">🔴 Autopilot</div></div>
      <div class="kpi"><div class="kpi-value">${stats.results["🍫"]}</div><div class="kpi-label">🍫 geplant</div></div>
      <div class="kpi"><div class="kpi-value">${stats.results["❤️"]}</div><div class="kpi-label">❤️ Alternative</div></div>
      <div class="kpi"><div class="kpi-value">${rate === null ? "–" : Math.round(rate * 100) + "%"}</div><div class="kpi-label">Erfolgsquote</div></div>
    </div>

    <h2>Häufigste Auslöser</h2>
    <div class="card">${barList(TRIGGERS, stats.triggers)}</div>

    <h2>Genutzte Strategien</h2>
    <div class="card">${barList(STRATEGIES, stats.strategies)}</div>
    `}

    <h2>Empfehlungen</h2>
    <div class="card">
      ${rec.tips.map((t) => `<div class="tip">${escapeHtml(t)}</div>`).join("")}
    </div>
  `;

  main.querySelectorAll(".segmented button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.reportPeriod = btn.dataset.period;
      renderReport();
    });
  });
}

function renderSettings() {
  const cfg = loadSyncConfig();
  main.innerHTML = `
    <h2>Cloud-Sync (GitHub)</h2>
    <div class="card">
      <p class="small-note">Deine Einträge werden zusätzlich als Datei in deinem eigenen GitHub-Repo gesichert, damit sie geräteübergreifend verfügbar sind. Der Zugriffstoken bleibt nur lokal auf diesem Gerät gespeichert.</p>
      <label class="field-label">Personal Access Token (fine-grained, nur dieses Repo, Contents: Read & Write)</label>
      <input type="password" id="s-token" value="${escapeAttr(cfg.token)}" placeholder="github_pat_…" />
      <div class="row" style="margin-top:8px;">
        <div style="flex:1;"><label class="field-label">Owner</label><input type="text" id="s-owner" value="${escapeAttr(cfg.owner)}" /></div>
        <div style="flex:1;"><label class="field-label">Repo</label><input type="text" id="s-repo" value="${escapeAttr(cfg.repo)}" /></div>
      </div>
      <div class="row" style="margin-top:8px;">
        <div style="flex:1;"><label class="field-label">Branch</label><input type="text" id="s-branch" value="${escapeAttr(cfg.branch)}" /></div>
        <div style="flex:1;"><label class="field-label">Dateipfad</label><input type="text" id="s-path" value="${escapeAttr(cfg.path)}" /></div>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" id="btn-save-config">💾 Speichern</button>
        <button type="button" class="btn btn-secondary" id="btn-test-connection">🔌 Testen</button>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="btn-sync-now">${state.syncing ? "⏳ Synchronisiere…" : "🔄 Jetzt synchronisieren"}</button>
      </div>
      <p class="small-note" style="margin-top:8px;">${cfg.lastSyncedAt ? `Zuletzt synchronisiert: ${new Date(cfg.lastSyncedAt).toLocaleString("de-DE")}` : "Noch nicht synchronisiert."} · ${state.entries.length} Einträge lokal</p>
    </div>

    <h2>App</h2>
    <div class="card">
      <p class="small-note"><strong>Zum Home-Bildschirm hinzufügen (iPhone):</strong> In Safari unten auf „Teilen" tippen → „Zum Home-Bildschirm" → hinzufügen. Danach startet die App wie eine normale App, auch offline.</p>
    </div>

    <details class="legend">
      <summary>ℹ️ Emoji-Legende</summary>
      <div class="legend-grid">
        <strong>Ergebnis</strong>
        ${Object.entries(RESULTS).map(([e, l]) => `<div>${e} – ${l}</div>`).join("")}
        <strong style="margin-top:6px;">Auslöser</strong>
        ${Object.entries(TRIGGERS).map(([e, l]) => `<div>${e} – ${l}</div>`).join("")}
        <strong style="margin-top:6px;">Strategie</strong>
        ${Object.entries(STRATEGIES).map(([e, l]) => `<div>${e} – ${l}</div>`).join("")}
      </div>
    </details>

    <h2>Danger Zone</h2>
    <div class="card">
      <button type="button" class="btn btn-danger" id="btn-clear-all">🗑️ Alle lokalen Daten löschen</button>
    </div>
  `;

  document.getElementById("btn-save-config").addEventListener("click", () => {
    const newCfg = {
      token: document.getElementById("s-token").value.trim(),
      owner: document.getElementById("s-owner").value.trim(),
      repo: document.getElementById("s-repo").value.trim(),
      branch: document.getElementById("s-branch").value.trim() || "main",
      path: document.getElementById("s-path").value.trim() || "data/entries.json",
      lastSyncedAt: cfg.lastSyncedAt,
    };
    saveSyncConfig(newCfg);
    toast("Einstellungen gespeichert.");
  });
  document.getElementById("btn-test-connection").addEventListener("click", async () => {
    const c = loadSyncConfig();
    if (!isConfigured(c)) return toast("Bitte zuerst Token, Owner, Repo ausfüllen.", true);
    try {
      await testConnection(c);
      toast("Verbindung erfolgreich.");
    } catch (err) {
      toast(err.message, true);
    }
  });
  document.getElementById("btn-sync-now").addEventListener("click", () => syncNow(true));
  document.getElementById("btn-clear-all").addEventListener("click", () => {
    if (!confirm("Wirklich ALLE lokalen Einträge löschen? Das kann nicht rückgängig gemacht werden.")) return;
    if (!confirm("Ganz sicher? Ohne aktuelle Cloud-Sicherung sind die Daten dann weg.")) return;
    state.entries = [];
    saveEntries(state.entries);
    toast("Lokale Daten gelöscht.");
    renderSettings();
  });
}

async function syncNow(manual = false) {
  const cfg = loadSyncConfig();
  if (!isConfigured(cfg)) {
    if (manual) toast("Bitte zuerst Cloud-Sync konfigurieren.", true);
    return;
  }
  state.syncing = true;
  if (manual) renderSettings();
  try {
    const { entries: remote, sha } = await fetchRemoteFile(cfg);
    const merged = mergeEntries(state.entries, remote);
    state.entries = merged;
    saveEntries(merged);
    const remoteJson = JSON.stringify(remote);
    const mergedJson = JSON.stringify(merged);
    if (remoteJson !== mergedJson) {
      await putRemoteFile(cfg, merged, sha);
    }
    cfg.lastSyncedAt = new Date().toISOString();
    saveSyncConfig(cfg);
    if (manual) toast("Synchronisierung erfolgreich.");
  } catch (err) {
    if (manual) toast(err.message, true);
  } finally {
    state.syncing = false;
    if (manual && state.tab === "settings") renderSettings();
    if (state.tab === "history") renderHistory();
    if (state.tab === "report") renderReport();
  }
}

let autoSyncTimer = null;
function maybeAutoSync() {
  const cfg = loadSyncConfig();
  if (!isConfigured(cfg) || !navigator.onLine) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => syncNow(false), 1500);
}

function render() {
  if (state.tab === "log") renderLog();
  else if (state.tab === "history") renderHistory();
  else if (state.tab === "report") renderReport();
  else if (state.tab === "settings") renderSettings();
}

render();
maybeAutoSync();
window.addEventListener("online", () => maybeAutoSync());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
