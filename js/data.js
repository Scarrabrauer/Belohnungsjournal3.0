// Taxonomie, Eintrags-Schema und lokaler Speicher (localStorage als "Source of Truth" pro Gerät).

export const RESULTS = {
  "🟢": "bewusst gehandelt",
  "🔴": "Autopilot",
  "⭐": "kein Heißhunger",
  "🍫": "1 geplanter Riegel",
  "🍟": "mehr gegessen als geplant",
  "❤️": "andere Belohnung statt Essen",
};

export const TRIGGERS = {
  "😟": "Stress",
  "😴": "Müdigkeit",
  "😐": "Langeweile",
  "📺": "Sofa / Fernsehen",
  "📱": "Handy / Scrollen",
  "🍽️": "Abendessen nicht sättigend",
  "🍺": "Alkohol",
  "👥": "Besuch / Gesellschaft",
  "🕗": "einfach die Uhrzeit / Routine",
};

export const STRATEGIES = {
  "☕": "Wasser oder Tee + warten",
  "💪": "Impuls überwunden",
  "🚶": "Spaziergang",
  "🪥": "Zähne geputzt",
  "📖": "Lesen / Ablenkung",
  "🧘": "Entspannung",
  "🍎": "geplante bewusste Portion",
};

export const SCENARIOS = {
  "— Manuell auswählen —": { results: [], triggers: [], strategies: [] },
  "⭐ Kein Heißhunger": { results: ["⭐"], triggers: [], strategies: [] },
  "🟢 Heißhunger überwunden": { results: ["🟢"], triggers: ["😴"], strategies: ["☕", "💪"] },
  "🟢 Bewusst 1 Riegel gegessen": { results: ["🟢", "🍫"], triggers: ["😟"], strategies: ["☕", "💪"] },
  "🟢 Andere Belohnung gewählt": { results: ["🟢", "❤️"], triggers: ["😐"], strategies: ["🚶", "💪"] },
  "🔴 Autopilot auf dem Sofa": { results: ["🔴", "🍟"], triggers: ["📺", "😴"], strategies: [] },
  "🔴 Stressessen": { results: ["🔴", "🍟"], triggers: ["😟"], strategies: [] },
  "🔴 Langeweile + Handy": { results: ["🔴", "🍟"], triggers: ["😐", "📱"], strategies: [] },
  "🔴 Einfach zur gewohnten Zeit": { results: ["🔴", "🍟"], triggers: ["🕗"], strategies: [] },
  "🟢 Geplante Portion statt Ausrutscher": { results: ["🟢", "🍎"], triggers: ["🕗"], strategies: ["🍎"] },
  "🔴 Alkohol war Auslöser": { results: ["🔴", "🍟"], triggers: ["🍺"], strategies: [] },
  "🔴 Besuch / Feier": { results: ["🔴", "🍟"], triggers: ["👥", "🍺"], strategies: [] },
  "🟢 Zähneputzen hat geholfen": { results: ["🟢"], triggers: ["📺"], strategies: ["🪥", "💪"] },
  "🟢 Spaziergang statt Naschen": { results: ["🟢", "❤️"], triggers: ["😟"], strategies: ["🚶", "💪"] },
};

const STORAGE_KEY = "bj_entries_v1";

export function uid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function upsertEntry(entries, entry) {
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  return entries;
}

export function deleteEntry(entries, id) {
  return entries.filter((e) => e.id !== id);
}

// Verschiedene Geräte/Sync-Läufe können denselben Zeitpunkt doppelt anlegen;
// wir mergen nach id, "zuletzt geändert gewinnt".
export function mergeEntries(local, remote) {
  const byId = new Map();
  for (const e of local) byId.set(e.id, e);
  for (const e of remote) {
    const existing = byId.get(e.id);
    if (!existing || new Date(e.updatedAt) > new Date(existing.updatedAt)) {
      byId.set(e.id, e);
    }
  }
  return Array.from(byId.values());
}

export function makeEntry({ id, date, time, results, triggers, strategies, scenario, note }) {
  return {
    id: id || uid(),
    date,
    time,
    results: results || [],
    triggers: triggers || [],
    strategies: strategies || [],
    scenario: scenario || "",
    note: note || "",
    updatedAt: new Date().toISOString(),
  };
}

export function formatEntryLine(entry) {
  const parts = [
    formatDateDE(entry.date),
    entry.time,
    entry.results.join(""),
  ];
  if (entry.triggers.length) parts.push(entry.triggers.join(""));
  if (entry.strategies.length) parts.push(entry.strategies.join(""));
  const line = parts.filter(Boolean).join(" ");
  return entry.note ? `${line} — ${entry.note}` : line;
}

export function formatDateDE(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.${y}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
