# DAW - Digital Audio Workstation

Web-based Digital Audio Workstation met een Logic Pro-achtige interface. Gebouwd met Web Audio API voor audio processing en Canvas voor waveform rendering.

## Features

- Multi-track timeline met waveform weergave
- Transport controls (play, stop, record, loop, metronoom)
- Per-track mixer (volume, pan, mute, solo)
- Real-time level meters
- Audio opname via microfoon
- Drag & drop audio bestanden
- Sound library met metadata (BPM, toonsoort, tags)
- Keyboard shortcuts
- WAV export (bounce/mixdown)

## Starten

### Frontend (development)
```bash
python serve.py
# → http://localhost:8085
```

### Backend (API + sound library)
```bash
pip install -r requirements.txt
python api_server.py
# → http://localhost:8085
```

### Database setup
```bash
psql -U postgres -c "CREATE DATABASE daw;"
psql -U postgres -d daw -f sql/01_create_tables.sql
psql -U postgres -d daw -f sql/02_seed_categories.sql
```

## Keyboard Shortcuts

| Toets | Actie |
|-------|-------|
| Space | Play / Pause |
| Enter | Stop |
| R | Record arm (geselecteerde track) |
| M | Mute |
| S | Solo |
| L | Loop aan/uit |
| K | Metronoom aan/uit |
| Ctrl+S | Opslaan |
| +/- | Zoom in/uit |
| Delete | Verwijder geselecteerde regio |
| Home/End | Spring naar begin/einde |

## Tech Stack

- **Frontend**: Vanilla JS + Web Audio API + Canvas 2D
- **Backend**: Flask + PostgreSQL
- **Audio**: AudioWorklet voor metering, OfflineAudioContext voor export

## Branch-strategie

| Branch | Doel |
|--------|------|
| `main` | Stabiele versie |
| `develop` | Actieve ontwikkeling |
| `feature/*` | Nieuwe functionaliteit (vanuit develop) |
