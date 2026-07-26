# 🍫 Belohnungsjournal

## Lokal starten

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Auf Streamlit Community Cloud veröffentlichen

1. Neues öffentliches GitHub-Repository erstellen.
2. `app.py`, `requirements.txt` und diese README hochladen.
3. Auf `share.streamlit.io` anmelden.
4. **Create app / Deploy an app** wählen.
5. Repository und `app.py` als Entrypoint auswählen.
6. Deploy starten.

## Datenspeicherung

Die App speichert Einträge zunächst nur in der aktuellen Streamlit-Sitzung. Auf Community Cloud kann dieser Speicher bei einem Neustart verloren gehen. Deshalb regelmäßig im Reiter **Verlauf** eine CSV herunterladen. Diese CSV kann später wieder importiert werden.
