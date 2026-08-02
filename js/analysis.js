// Regelbasierte Auswertung: Kennzahlen + Muster-Erkennung + Textempfehlungen.
// Läuft komplett offline auf dem Gerät, keine externe API nötig.

import { TRIGGERS, STRATEGIES } from "./data.js";

const SLIP_RESULTS = ["🔴", "🍟"];
const OK_RESULTS = ["🟢", "⭐", "❤️", "🍎"];

const TRIGGER_TIPS = {
  "😟": "Stress ist bei dir ein häufiger Auslöser. Probier vor dem Griff zum Essen 3 tiefe Atemzüge oder 5 Minuten frische Luft — der Cortisol-Effekt lässt oft schneller nach als gedacht.",
  "😴": "Müdigkeit verstärkt Heißhunger messbar (mehr Ghrelin). Achte in den nächsten Nächten auf etwas mehr Schlaf und beobachte, ob sich das Muster ändert.",
  "😐": "Langeweile ist bei dir ein häufiger Auslöser. Leg dir eine feste Alternativ-Aktivität für genau solche Momente zurecht (Buch, Anruf, Spaziergang) — dagegen hilft ein Ersatz-Reiz, nicht nur Willenskraft.",
  "📺": "Fernsehen ist bei dir oft mit Essen gekoppelt. Versuch, Naschen und Bildschirmzeit bewusst zu entkoppeln, z. B. nur Tee auf dem Sofa.",
  "📱": "Scrollen aktiviert eine ähnliche Belohnungsschleife wie Naschen. Handy testweise in einen anderen Raum legen kann den Automatismus unterbrechen.",
  "🍽️": "Wenn das Abendessen als nicht sättigend empfunden wird, erhöhe Eiweiß und Ballaststoffe (Hülsenfrüchte, Vollkorn, Joghurt/Quark) — das verlängert die Sättigung spürbar.",
  "🍺": "Alkohol senkt nachweislich die Hemmschwelle fürs Naschen. An solchen Tagen lohnt sich ein bewusst geplanter kleiner Snack vorher.",
  "👥": "In Gesellschaft fällt bewusstes Essen schwerer — das ist normal. Plane bei Besuch eine kleine bewusste Portion ein statt komplettem Verzicht.",
  "🕗": "Bei dir scheint es oft weniger um echten Hunger als um eine eingespielte Abend-Routine zu gehen. Ein festes Ritual direkt nach dem Abendessen (Zähneputzen, Tee, kurzer Spaziergang) kann diesen Automatismus durchbrechen.",
};

function inPeriod(entry, start, end) {
  const d = new Date(`${entry.date}T00:00`);
  return d >= start && d <= end;
}

function hasAny(list, set) {
  return list.some((x) => set.includes(x));
}

export function periodBounds(period, reference = new Date()) {
  const end = new Date(reference);
  end.setHours(23, 59, 59, 999);
  let start;
  if (period === "week") {
    start = new Date(reference);
    const day = (start.getDay() + 6) % 7; // Montag = 0
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  } else {
    start = new Date(2000, 0, 1);
  }
  return { start, end };
}

export function filterByPeriod(entries, period) {
  const { start, end } = periodBounds(period);
  return entries.filter((e) => inPeriod(e, start, end));
}

export function computeStats(entries) {
  const count = (dict, field) => {
    const out = {};
    for (const key of Object.keys(dict)) out[key] = 0;
    for (const e of entries) {
      for (const v of e[field] || []) {
        if (out[v] !== undefined) out[v] += 1;
      }
    }
    return out;
  };
  return {
    total: entries.length,
    results: count(
      { "🟢": 1, "⭐": 1, "🔴": 1, "🍫": 1, "🍟": 1, "❤️": 1 },
      "results"
    ),
    triggers: count(TRIGGERS, "triggers"),
    strategies: count(STRATEGIES, "strategies"),
  };
}

export function successRate(entries) {
  const relevant = entries.filter((e) => hasAny(e.results, [...OK_RESULTS, ...SLIP_RESULTS]));
  if (!relevant.length) return null;
  const ok = relevant.filter((e) => hasAny(e.results, OK_RESULTS) && !hasAny(e.results, SLIP_RESULTS)).length;
  return ok / relevant.length;
}

export function topTrigger(entries) {
  const slips = entries.filter((e) => hasAny(e.results, SLIP_RESULTS));
  const counts = {};
  for (const e of slips) {
    for (const t of e.triggers || []) counts[t] = (counts[t] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] < 2) return null;
  return { emoji: sorted[0][0], count: sorted[0][1] };
}

export function mostEffectiveStrategy(entries) {
  const wins = entries.filter((e) => hasAny(e.results, OK_RESULTS) && !hasAny(e.results, SLIP_RESULTS));
  const counts = {};
  for (const e of wins) {
    for (const s of e.strategies || []) counts[s] = (counts[s] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] < 2) return null;
  return { emoji: sorted[0][0], count: sorted[0][1] };
}

export function currentStreak(entries) {
  const byDate = new Map();
  for (const e of entries) {
    const list = byDate.get(e.date) || [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const days = Array.from(byDate.keys()).sort().reverse();
  let streak = 0;
  for (const day of days) {
    const dayEntries = byDate.get(day);
    if (dayEntries.some((e) => hasAny(e.results, SLIP_RESULTS))) break;
    streak += 1;
  }
  return streak;
}

export function buildRecommendations(entries, period) {
  const current = filterByPeriod(entries, period);
  if (current.length < 5) {
    return {
      insufficientData: true,
      tips: ["Sammle ein paar Einträge, dann zeige ich dir hier Muster und konkrete Tipps."],
    };
  }

  const tips = [];

  const trigger = topTrigger(current);
  if (trigger && TRIGGER_TIPS[trigger.emoji]) {
    tips.push(TRIGGER_TIPS[trigger.emoji]);
  }

  const strat = mostEffectiveStrategy(current);
  if (strat) {
    tips.push(
      `„${STRATEGIES[strat.emoji]}" hat bei dir am häufigsten funktioniert (${strat.count}×). Lohnt sich, das gezielt einzuplanen, wenn der Impuls kommt.`
    );
  }

  const streak = currentStreak(entries);
  if (streak >= 3) {
    tips.push(`Du hast aktuell ${streak} Tage in Folge ohne Autopilot-Griff getrackt. Weiter so.`);
  }

  if (!tips.length) {
    tips.push("Noch kein eindeutiges Muster erkennbar — trag weiter ehrlich ein, dann werden die Empfehlungen treffsicherer.");
  }

  return { insufficientData: false, tips: tips.slice(0, 4) };
}
