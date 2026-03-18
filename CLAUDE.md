# DAW - Claude Code Instructies

## Project
Web-based Digital Audio Workstation met Logic Pro-achtige interface.
Locatie: `E:\scripts\webscraper\CBSbuurt\daw\`

## Starten
```bash
python serve.py       # Static files: http://localhost:8085
python api_server.py  # Flask API: http://localhost:8085
```

## Branch-strategie
- **main** = stabiel/productie
- **develop** = dagelijkse ontwikkeling (standaard werkbranch)
- **feature/*** = nieuwe features, maak aan vanuit develop

## Architectuur
- `index.html` - Volledige DAW frontend (single-file, ~groot)
  - `AudioEngine` class - Web Audio API, scheduling, opname
  - `TimelineRenderer` class - Canvas 2D rendering
  - `DAWController` class - Hoofd controller, events, state management
- `api_server.py` - Flask API voor projecten en sound library
- `worklets/` - AudioWorklet processors (meter, gain)
- `sql/` - PostgreSQL schema
- `audio/` - Audio bestanden (gitignored)

## Database
PostgreSQL database `daw`:
- `categories` - Sound categorieën
- `sounds` - Audio metadata (tags, BPM, key, waveform peaks)
- `projects` - DAW sessies (project_data als JSONB)

## Waar gebleven (maart 2026)
- Fase 1 core DAW: timeline, transport, mixer, recording, export
- Fase 2 (todo): Sound library browser met zoek/filter
- Fase 3 (todo): Effects chain per track
- Fase 4 (todo): Mobile companion PWA

## Let op
- Audio bestanden staan in .gitignore
- Web Audio API vereist user interaction voordat AudioContext start
- AudioWorklet files moeten als aparte JS bestanden geladen worden
- Port 8085 (geen conflict met 8888/8091/8090/8765/9090)
