# DAW - Browser-based Music Production Platform

Web-based muziekproductie platform met DAW, DJ app, audio editor, producer contests en live streaming. Gebouwd met Web Audio API, Canvas en Flask.

## Features

### DAW (index.html)
- Multi-track timeline met waveform weergave
- Transport controls (play, stop, record, loop, metronoom)
- Mixer met VU meters, rotary knobs, EQ en master channel
- Drag & drop van library naar timeline met positie-gebaseerde plaatsing
- Improvisatie-engine: 18 toonladders, 12 progressies, muziektheorie
- Sound library met metadata (BPM, toonsoort, tags)
- WAV export (bounce/mixdown)

### DJ App (dj.html)
- Twee decks met onafhankelijke controls
- Crossfader en effecten
- Jamendo en Freesound muziek streaming

### Audio Editor (editor.html)
- Cut, copy, paste bewerkingen
- Effecten en filters
- Audio export

### Producer Contests (contests.html)
- Producer battles
- Voting systeem
- Leaderboard

### Live Kanalen (live.html)
- Streaming channels
- Live chat

## Tech Stack

- **Frontend**: Vanilla JS + Web Audio API + Canvas 2D
- **Backend**: Flask (Python)
- **Database**: PostgreSQL
- **Audio**: AudioWorklet voor metering, OfflineAudioContext voor export

## Starten

```bash
# Database setup
psql -U postgres -c "CREATE DATABASE daw;"
psql -U postgres -d daw -f sql/01_create_tables.sql
psql -U postgres -d daw -f sql/02_seed_categories.sql

# Server starten
pip install -r requirements.txt
python serve.py
```

## URLs

| Pagina | URL |
|--------|-----|
| DAW | http://localhost:8086 |
| DJ App | http://localhost:8086/dj.html |
| Audio Editor | http://localhost:8086/editor.html |
| Contests | http://localhost:8086/contests.html |
| Live | http://localhost:8086/live.html |

## Keyboard Shortcuts (DAW)

| Toets | Actie |
|-------|-------|
| Space | Play / Pause |
| Enter | Stop |
| R | Record arm |
| M | Mute |
| S | Solo |
| L | Loop aan/uit |
| K | Metronoom aan/uit |
| Ctrl+S | Opslaan |
| +/- | Zoom in/uit |
| Delete | Verwijder regio |

## Branch-strategie

| Branch | Doel |
|--------|------|
| `main` | Stabiele versie |
| `develop` | Actieve ontwikkeling |
| `feature/*` | Nieuwe functionaliteit |
