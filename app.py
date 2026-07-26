from __future__ import annotations

from datetime import date, timedelta
import pandas as pd
import streamlit as st


st.set_page_config(
    page_title="Belohnungsjournal",
    page_icon="🍫",
    layout="centered",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
    .block-container {max-width: 780px; padding-top: 1.2rem; padding-bottom: 4rem;}
    h1 {letter-spacing: -0.04em;}
    div[data-testid="stMetric"] {
        border: 1px solid rgba(128,128,128,.22);
        border-radius: 16px;
        padding: 12px;
    }
    .journal-entry {
        font-size: 1.35rem;
        font-weight: 750;
        padding: 1rem;
        border-radius: 16px;
        background: rgba(128,128,128,.10);
        margin: .5rem 0 1rem;
    }
    .small-note {opacity: .72; font-size: .9rem;}
    </style>
    """,
    unsafe_allow_html=True,
)

RESULTS = {
    "🟢": "bewusst gehandelt",
    "🔴": "Autopilot",
    "⭐": "kein Heißhunger",
    "🍫": "1 geplanter Riegel",
    "🍟": "mehr gegessen als geplant",
    "❤️": "andere Belohnung statt Essen",
}
TRIGGERS = {
    "😟": "Stress",
    "😴": "Müdigkeit",
    "😐": "Langeweile",
    "📺": "Sofa / Fernsehen",
    "📱": "Handy / Scrollen",
    "🍽️": "Abendessen nicht sättigend",
    "🍺": "Alkohol",
    "👥": "Besuch / Gesellschaft",
}
STRATEGIES = {
    "☕": "Wasser oder Tee + warten",
    "💪": "Impuls überwunden",
    "🚶": "Spaziergang",
    "🪥": "Zähne geputzt",
    "📖": "Lesen / Ablenkung",
    "🧘": "Entspannung",
}

SCENARIOS = {
    "— Manuell auswählen —": ([], [], []),
    "⭐ Kein Heißhunger": (["⭐"], [], []),
    "🟢 Heißhunger überwunden": (["🟢"], ["😴"], ["☕", "💪"]),
    "🟢 Bewusst 1 Riegel gegessen": (["🟢", "🍫"], ["😟"], ["☕", "💪"]),
    "🟢 Andere Belohnung gewählt": (["🟢", "❤️"], ["😐"], ["🚶", "💪"]),
    "🔴 Autopilot auf dem Sofa": (["🔴", "🍟"], ["📺", "😴"], []),
    "🔴 Stressessen": (["🔴", "🍟"], ["😟"], []),
    "🔴 Langeweile + Handy": (["🔴", "🍟"], ["😐", "📱"], []),
    "🟢 Schokolade bewusst beim Fernsehabend": (["🟢", "🍫"], ["📺"], ["☕", "💪"]),
    "⭐ Kein Heißhunger trotz Stress": (["⭐"], ["😟"], []),
    "❤️ Spaziergang statt Schokolade": (["🟢", "❤️"], ["😟"], ["🚶", "💪"]),
    "🟢 Nur Wasser/Tee hat gereicht": (["🟢"], ["😐"], ["☕", "💪"]),
    "🟢 Zähneputzen hat geholfen": (["🟢"], ["📺"], ["🪥", "💪"]),
    "🟢 Lesen statt Essen": (["🟢"], ["😴"], ["📖", "💪"]),
    "🔴 Alkohol war Auslöser": (["🔴", "🍟"], ["🍺"], []),
    "🔴 Besuch/Feier": (["🔴", "🍟"], ["👥", "🍺"], []),
}

COLUMNS = ["Datum", "Ergebnis", "Auslöser", "Strategie", "Szenario", "Eintrag"]

if "entries" not in st.session_state:
    st.session_state.entries = []
if "entry_date" not in st.session_state:
    st.session_state.entry_date = date.today()
if "selected_results" not in st.session_state:
    st.session_state.selected_results = []
if "selected_triggers" not in st.session_state:
    st.session_state.selected_triggers = []
if "selected_strategies" not in st.session_state:
    st.session_state.selected_strategies = []
if "scenario" not in st.session_state:
    st.session_state.scenario = "— Manuell auswählen —"


def format_date(d: date) -> str:
    return f"{d.day}.{d.month}.{d.year}"


def create_entry(d: date, results: list[str], triggers: list[str], strategies: list[str]) -> str:
    parts = [format_date(d), "".join(results)]
    if triggers:
        parts.append("".join(triggers))
    if strategies:
        parts.append("".join(strategies))
    return " ".join(parts)


def dataframe_from_entries() -> pd.DataFrame:
    if not st.session_state.entries:
        return pd.DataFrame(columns=COLUMNS)
    df = pd.DataFrame(st.session_state.entries)
    for col in COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df["Datum_sort"] = pd.to_datetime(df["Datum"], format="%d.%m.%Y", errors="coerce")
    return df.sort_values("Datum_sort", ascending=False).drop(columns=["Datum_sort"])


def csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False, sep=";").encode("utf-8-sig")


def count_emoji(series: pd.Series, emoji: str) -> int:
    return int(series.fillna("").str.contains(emoji, regex=False).sum())


def apply_scenario():
    results, triggers, strategies = SCENARIOS[st.session_state.scenario]
    st.session_state.selected_results = results.copy()
    st.session_state.selected_triggers = triggers.copy()
    st.session_state.selected_strategies = strategies.copy()


st.title("🍫 Belohnungsjournal")
st.caption("Nicht perfekt. Sondern bewusst.")

tab_input, tab_history, tab_report, tab_help = st.tabs(
    ["✍️ Eintragen", "📚 Verlauf", "📊 Auswertung", "ℹ️ Legende"]
)

with tab_input:
    st.subheader("Datum")
    left, middle, right = st.columns([1, 4, 1])
    with left:
        if st.button("←", use_container_width=True, help="Einen Tag zurück"):
            st.session_state.entry_date -= timedelta(days=1)
            st.rerun()
    with middle:
        chosen_date = st.date_input(
            "Datum auswählen",
            value=st.session_state.entry_date,
            label_visibility="collapsed",
            format="DD.MM.YYYY",
        )
        if chosen_date != st.session_state.entry_date:
            st.session_state.entry_date = chosen_date
    with right:
        if st.button("→", use_container_width=True, help="Einen Tag vor"):
            st.session_state.entry_date += timedelta(days=1)
            st.rerun()

    st.subheader("⚡ Szenario-Shortcut")
    st.selectbox(
        "Typische Situation auswählen",
        options=list(SCENARIOS.keys()),
        key="scenario",
        on_change=apply_scenario,
    )
    st.caption("Das Szenario füllt die drei Bereiche automatisch. Danach kannst du einzelne Emojis noch ändern.")

    st.subheader("1. Ergebnis")
    st.multiselect(
        "Ein bis zwei Emojis auswählen",
        options=list(RESULTS),
        max_selections=2,
        placeholder="🟢  🔴  ⭐  🍫  🍟  ❤️",
        key="selected_results",
    )

    st.subheader("2. Auslöser")
    st.multiselect(
        "Optional, maximal zwei",
        options=list(TRIGGERS),
        max_selections=2,
        placeholder="😟  😴  😐  📺  📱  🍽️  🍺  👥",
        key="selected_triggers",
    )

    st.subheader("3. Strategie")
    st.multiselect(
        "Optional, maximal zwei",
        options=list(STRATEGIES),
        max_selections=2,
        placeholder="☕  💪  🚶  🪥  📖  🧘",
        key="selected_strategies",
    )

    if st.session_state.selected_results:
        entry_text = create_entry(
            st.session_state.entry_date,
            st.session_state.selected_results,
            st.session_state.selected_triggers,
            st.session_state.selected_strategies,
        )
        st.markdown(f'<div class="journal-entry">{entry_text}</div>', unsafe_allow_html=True)
    else:
        entry_text = ""
        st.info("Wähle ein Szenario oder mindestens ein Ergebnis aus.")

    save_col, reset_col = st.columns(2)
    with save_col:
        if st.button("💾 Eintrag speichern", type="primary", use_container_width=True):
            if not st.session_state.selected_results:
                st.error("Bitte zuerst ein Szenario oder mindestens ein Ergebnis auswählen.")
            else:
                row = {
                    "Datum": format_date(st.session_state.entry_date),
                    "Ergebnis": "".join(st.session_state.selected_results),
                    "Auslöser": "".join(st.session_state.selected_triggers),
                    "Strategie": "".join(st.session_state.selected_strategies),
                    "Szenario": "" if st.session_state.scenario == "— Manuell auswählen —" else st.session_state.scenario,
                    "Eintrag": entry_text,
                }
                st.session_state.entries = [
                    item for item in st.session_state.entries
                    if item.get("Datum") != row["Datum"]
                ]
                st.session_state.entries.append(row)
                st.success("Gespeichert – bewusster Check-in erledigt. 💚")
    with reset_col:
        if st.button("↺ Auswahl zurücksetzen", use_container_width=True):
            st.session_state.scenario = "— Manuell auswählen —"
            st.session_state.selected_results = []
            st.session_state.selected_triggers = []
            st.session_state.selected_strategies = []
            st.rerun()

    st.text_input(
        "Fertiger Eintrag zum Kopieren",
        value=entry_text,
        help="Antippen, markieren und kopieren.",
    )

with tab_history:
    st.subheader("Gespeicherte Einträge")
    uploaded = st.file_uploader("Vorhandenen CSV-Verlauf laden", type=["csv"])
    if uploaded is not None:
        try:
            imported = pd.read_csv(uploaded, sep=None, engine="python")
            missing = [c for c in ["Datum", "Ergebnis", "Auslöser", "Strategie", "Eintrag"] if c not in imported.columns]
            if missing:
                st.error("Die CSV passt nicht zum Belohnungsjournal.")
            elif st.button("CSV jetzt übernehmen", type="primary"):
                if "Szenario" not in imported.columns:
                    imported["Szenario"] = ""
                st.session_state.entries = imported[COLUMNS].fillna("").to_dict("records")
                st.success("Verlauf übernommen.")
                st.rerun()
        except Exception as exc:
            st.error(f"CSV konnte nicht gelesen werden: {exc}")

    df = dataframe_from_entries()
    if df.empty:
        st.info("Noch keine Einträge gespeichert.")
    else:
        st.dataframe(df, use_container_width=True, hide_index=True)
        st.download_button(
            "⬇️ Verlauf als CSV sichern",
            data=csv_bytes(df),
            file_name="belohnungsjournal.csv",
            mime="text/csv",
            use_container_width=True,
        )
        all_entries = "\n".join(
            df.sort_values(
                by="Datum",
                key=lambda s: pd.to_datetime(s, format="%d.%m.%Y", errors="coerce")
            )["Eintrag"].tolist()
        )
        st.text_area("Alle Einträge für ChatGPT", value=all_entries, height=180)
        if st.button("🗑️ Verlauf löschen", use_container_width=True):
            st.session_state.entries = []
            st.rerun()

    st.markdown(
        '<p class="small-note">Auf Streamlit Community Cloud ist der Sitzungsspeicher nicht dauerhaft. '
        'Sichere den Verlauf deshalb regelmäßig als CSV.</p>',
        unsafe_allow_html=True,
    )

with tab_report:
    st.subheader("Deine Übersicht")
    df = dataframe_from_entries()

    if df.empty:
        st.info("Für eine Auswertung brauchen wir zuerst ein paar Einträge.")
    else:
        df_dates = pd.to_datetime(df["Datum"], format="%d.%m.%Y", errors="coerce")
        today = pd.Timestamp(date.today())
        start_week = today - pd.Timedelta(days=today.weekday())
        start_month = today.replace(day=1)

        period = st.radio(
            "Zeitraum",
            options=["Diese Woche", "Dieser Monat", "Gesamt"],
            horizontal=True,
        )
        if period == "Diese Woche":
            view = df[df_dates >= start_week]
        elif period == "Dieser Monat":
            view = df[df_dates >= start_month]
        else:
            view = df

        if view.empty:
            st.info("Für diesen Zeitraum gibt es noch keine Einträge.")
        else:
            m1, m2, m3 = st.columns(3)
            m1.metric("🟢 bewusst", count_emoji(view["Ergebnis"], "🟢"))
            m2.metric("⭐ ohne Heißhunger", count_emoji(view["Ergebnis"], "⭐"))
            m3.metric("🔴 Autopilot", count_emoji(view["Ergebnis"], "🔴"))

            m4, m5, m6 = st.columns(3)
            m4.metric("🍫 geplant", count_emoji(view["Ergebnis"], "🍫"))
            m5.metric("❤️ andere Belohnung", count_emoji(view["Ergebnis"], "❤️"))
            m6.metric("💪 überwunden", count_emoji(view["Strategie"], "💪"))

            scenario_counts = (
                view["Szenario"].fillna("")
                .replace("", pd.NA)
                .dropna()
                .value_counts()
                .rename_axis("Szenario")
                .reset_index(name="Anzahl")
            )
            if not scenario_counts.empty:
                st.markdown("#### Häufigste Szenarien")
                st.bar_chart(scenario_counts.set_index("Szenario"))

with tab_help:
    st.subheader("Emoji-Legende")
    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown("#### Ergebnis")
        for emoji, label in RESULTS.items():
            st.write(f"{emoji} – {label}")
    with c2:
        st.markdown("#### Auslöser")
        for emoji, label in TRIGGERS.items():
            st.write(f"{emoji} – {label}")
    with c3:
        st.markdown("#### Strategie")
        for emoji, label in STRATEGIES.items():
            st.write(f"{emoji} – {label}")

    st.markdown("#### Standardformat")
    st.code("26.7.2026 🟢🍫 😟 ☕💪", language=None)
