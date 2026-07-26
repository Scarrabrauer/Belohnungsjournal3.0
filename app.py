from __future__ import annotations

from datetime import date, timedelta
import pandas as pd
import streamlit as st

st.set_page_config(page_title='Belohnungsjournal', page_icon='🍫', layout='centered')

st.markdown('''
<style>
.block-container {max-width: 760px; padding-top: 1.2rem; padding-bottom: 4rem;}
h1 {letter-spacing: -0.04em;}
div[data-testid="stMetric"] {border: 1px solid rgba(128,128,128,.22); border-radius: 16px; padding: 12px;}
.journal-entry {font-size: 1.35rem; font-weight: 750; padding: 1rem; border-radius: 16px; background: rgba(128,128,128,.10); margin: .5rem 0 1rem;}
.small-note {opacity: .72; font-size: .9rem;}
</style>
''', unsafe_allow_html=True)

RESULTS = {'🟢':'bewusst gehandelt','🔴':'Autopilot','⭐':'kein Heißhunger','🍫':'1 geplanter Riegel','🍟':'mehr gegessen als geplant','❤️':'andere Belohnung statt Essen'}
TRIGGERS = {'😟':'Stress','😴':'Müdigkeit','😐':'Langeweile','📺':'Sofa / Fernsehen','📱':'Handy / Scrollen','🍽️':'Abendessen nicht sättigend','🍺':'Alkohol','👥':'Besuch / Gesellschaft'}
STRATEGIES = {'☕':'Wasser oder Tee + warten','💪':'Impuls überwunden','🚶':'Spaziergang','🪥':'Zähne geputzt','📖':'Lesen / Ablenkung','🧘':'Entspannung'}
COLUMNS = ['Datum','Ergebnis','Auslöser','Strategie','Eintrag']

if 'entries' not in st.session_state:
    st.session_state.entries = []
if 'entry_date' not in st.session_state:
    st.session_state.entry_date = date.today()

def format_date(d: date) -> str:
    return f'{d.day}.{d.month}.{d.year}'

def create_entry(d, results, triggers, strategies):
    parts = [format_date(d), ''.join(results)]
    if triggers: parts.append(''.join(triggers))
    if strategies: parts.append(''.join(strategies))
    return ' '.join(parts)

def dataframe_from_entries():
    if not st.session_state.entries:
        return pd.DataFrame(columns=COLUMNS)
    df = pd.DataFrame(st.session_state.entries)
    df['_sort'] = pd.to_datetime(df['Datum'], format='%d.%m.%Y', errors='coerce')
    return df.sort_values('_sort', ascending=False).drop(columns=['_sort'])

def count_emoji(series, emoji):
    return int(series.fillna('').str.contains(emoji, regex=False).sum())

st.title('🍫 Belohnungsjournal')
st.caption('Nicht perfekt. Sondern bewusst.')

tab_input, tab_history, tab_report, tab_help = st.tabs(['✍️ Eintragen','📚 Verlauf','📊 Auswertung','ℹ️ Legende'])

with tab_input:
    st.subheader('Datum')
    left, middle, right = st.columns([1,4,1])
    with left:
        if st.button('←', use_container_width=True):
            st.session_state.entry_date -= timedelta(days=1)
            st.rerun()
    with middle:
        chosen = st.date_input('Datum auswählen', value=st.session_state.entry_date, label_visibility='collapsed', format='DD.MM.YYYY')
        if chosen != st.session_state.entry_date:
            st.session_state.entry_date = chosen
    with right:
        if st.button('→', use_container_width=True):
            st.session_state.entry_date += timedelta(days=1)
            st.rerun()

    st.subheader('1. Ergebnis')
    selected_results = st.multiselect('Ein bis zwei Emojis auswählen', list(RESULTS), max_selections=2, placeholder='🟢  🔴  ⭐  🍫  🍟  ❤️', key='selected_results')
    st.subheader('2. Auslöser')
    selected_triggers = st.multiselect('Optional, maximal zwei', list(TRIGGERS), max_selections=2, placeholder='😟  😴  😐  📺  📱  🍽️  🍺  👥', key='selected_triggers')
    st.subheader('3. Strategie')
    selected_strategies = st.multiselect('Optional, maximal zwei', list(STRATEGIES), max_selections=2, placeholder='☕  💪  🚶  🪥  📖  🧘', key='selected_strategies')

    entry_text = create_entry(st.session_state.entry_date, selected_results, selected_triggers, selected_strategies) if selected_results else ''
    if entry_text:
        st.markdown(f'<div class="journal-entry">{entry_text}</div>', unsafe_allow_html=True)
    else:
        st.info('Wähle mindestens ein Ergebnis aus.')

    c1, c2 = st.columns(2)
    with c1:
        if st.button('💾 Eintrag speichern', type='primary', use_container_width=True):
            if not selected_results:
                st.error('Bitte zuerst mindestens ein Ergebnis auswählen.')
            else:
                row = {'Datum':format_date(st.session_state.entry_date),'Ergebnis':''.join(selected_results),'Auslöser':''.join(selected_triggers),'Strategie':''.join(selected_strategies),'Eintrag':entry_text}
                st.session_state.entries = [x for x in st.session_state.entries if x['Datum'] != row['Datum']]
                st.session_state.entries.append(row)
                st.success('Gespeichert – das zählt als bewusster Check-in. 💚')
    with c2:
        if st.button('📅 Auf heute setzen', use_container_width=True):
            st.session_state.entry_date = date.today()
            st.rerun()

    st.caption('Zum Senden an ChatGPT den fertigen Eintrag oben markieren und kopieren.')

with tab_history:
    st.subheader('Gespeicherte Einträge')
    uploaded = st.file_uploader('Vorhandenen CSV-Verlauf laden', type=['csv'])
    if uploaded is not None:
        try:
            imported = pd.read_csv(uploaded, sep=None, engine='python')
            missing = [c for c in COLUMNS if c not in imported.columns]
            if missing:
                st.error('Die CSV passt nicht zum Belohnungsjournal.')
            elif st.button('CSV jetzt übernehmen', type='primary'):
                st.session_state.entries = imported[COLUMNS].fillna('').to_dict('records')
                st.success('Verlauf übernommen.')
                st.rerun()
        except Exception as exc:
            st.error(f'CSV konnte nicht gelesen werden: {exc}')

    df = dataframe_from_entries()
    if df.empty:
        st.info('Noch keine Einträge gespeichert.')
    else:
        st.dataframe(df, use_container_width=True, hide_index=True)
        st.download_button('⬇️ Verlauf als CSV sichern', data=df.to_csv(index=False, sep=';').encode('utf-8-sig'), file_name='belohnungsjournal.csv', mime='text/csv', use_container_width=True)
        ordered = df.copy()
        ordered['_sort'] = pd.to_datetime(ordered['Datum'], format='%d.%m.%Y', errors='coerce')
        all_entries = '\n'.join(ordered.sort_values('_sort')['Eintrag'].tolist())
        st.text_area('Alle Einträge für ChatGPT', value=all_entries, height=180)
        if st.button('🗑️ Verlauf löschen', use_container_width=True):
            st.session_state.entries = []
            st.rerun()
    st.markdown('<p class="small-note">Wichtig: Auf Streamlit Community Cloud ist der Sitzungsspeicher nicht dauerhaft. Sichere den Verlauf deshalb regelmäßig als CSV.</p>', unsafe_allow_html=True)

with tab_report:
    st.subheader('Deine Übersicht')
    df = dataframe_from_entries()
    if df.empty:
        st.info('Für eine Auswertung brauchen wir zuerst ein paar Einträge.')
    else:
        dates = pd.to_datetime(df['Datum'], format='%d.%m.%Y', errors='coerce')
        today = pd.Timestamp(date.today())
        period = st.radio('Zeitraum', ['Diese Woche','Dieser Monat','Gesamt'], horizontal=True, index=1)
        if period == 'Diese Woche':
            start = today - pd.Timedelta(days=today.weekday())
            view = df[dates >= start]
        elif period == 'Dieser Monat':
            view = df[dates >= today.replace(day=1)]
        else:
            view = df
        if view.empty:
            st.info('Für diesen Zeitraum gibt es noch keine Einträge.')
        else:
            a,b,c = st.columns(3)
            a.metric('🟢 bewusst', count_emoji(view['Ergebnis'],'🟢'))
            b.metric('⭐ ohne Heißhunger', count_emoji(view['Ergebnis'],'⭐'))
            c.metric('🔴 Autopilot', count_emoji(view['Ergebnis'],'🔴'))
            d,e,f = st.columns(3)
            d.metric('🍫 geplant', count_emoji(view['Ergebnis'],'🍫'))
            e.metric('❤️ andere Belohnung', count_emoji(view['Ergebnis'],'❤️'))
            f.metric('💪 überwunden', count_emoji(view['Strategie'],'💪'))

            trigger_counts = {f'{e} {l}':count_emoji(view['Auslöser'],e) for e,l in TRIGGERS.items()}
            strategy_counts = {f'{e} {l}':count_emoji(view['Strategie'],e) for e,l in STRATEGIES.items()}
            tdf = pd.DataFrame({'Auslöser':trigger_counts.keys(),'Anzahl':trigger_counts.values()}).query('Anzahl > 0').sort_values('Anzahl', ascending=False)
            sdf = pd.DataFrame({'Strategie':strategy_counts.keys(),'Anzahl':strategy_counts.values()}).query('Anzahl > 0').sort_values('Anzahl', ascending=False)
            if not tdf.empty:
                st.markdown('#### Häufigste Auslöser')
                st.bar_chart(tdf.set_index('Auslöser'))
            if not sdf.empty:
                st.markdown('#### Eingesetzte Strategien')
                st.bar_chart(sdf.set_index('Strategie'))
            conscious = count_emoji(view['Ergebnis'],'🟢')
            autopilot = count_emoji(view['Ergebnis'],'🔴')
            if conscious + autopilot:
                st.success(f'Du hast in diesem Zeitraum bei **{round(conscious/(conscious+autopilot)*100)} %** der bewerteten Abende bewusst statt im Autopilot gehandelt.')

with tab_help:
    st.subheader('Emoji-Legende')
    c1,c2,c3 = st.columns(3)
    with c1:
        st.markdown('#### Ergebnis')
        for e,l in RESULTS.items(): st.write(f'{e} – {l}')
    with c2:
        st.markdown('#### Auslöser')
        for e,l in TRIGGERS.items(): st.write(f'{e} – {l}')
    with c3:
        st.markdown('#### Strategie')
        for e,l in STRATEGIES.items(): st.write(f'{e} – {l}')
    st.markdown('#### Standardformat')
    st.code('26.7.2026 🟢🍫 😟 ☕💪', language=None)
    st.info('🍫 ist kein Misserfolg. Entscheidend ist, dass du bewusst entschieden hast.')
