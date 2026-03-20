# DAW - Claude Code Instructies

## Project
Web-based muziekproductie platform met 5 pagina's.
Locatie: `E:\scripts\webscraper\CBSbuurt\daw\`
GitHub: AnneVersion/daw

## Starten
```bash
python serve.py  # Start Flask API + static files: http://localhost:8086
```

## Branch-strategie
- **main** = stabiel/productie
- **develop** = dagelijkse ontwikkeling (standaard werkbranch)
- **feature/*** = nieuwe features, maak aan vanuit develop

## Pagina's
| Pagina | URL | Beschrijving |
|--------|-----|-------------|
| `index.html` | `/` | DAW - Multi-track timeline, mixer, recording, export |
| `dj.html` | `/dj.html` | DJ App - Twee decks, crossfader, effects, Jamendo/Freesound streaming |
| `editor.html` | `/editor.html` | Audio Editor - 31 effects, cut/copy/paste, spectrum, spectrogram, WAV export |
| `contests.html` | `/contests.html` | Producer Contests - Battles, voting, leaderboard |
| `live.html` | `/live.html` | Live Kanalen - Streaming channels, chat |

## Architectuur
- `index.html` - DAW frontend (single-file)
  - `AudioEngine` class - Web Audio API, scheduling, opname
  - `TimelineRenderer` class - Canvas 2D rendering
  - `DAWController` class - Hoofd controller, events, state management
- `dj.html` - DJ App met dual decks, crossfader, effecten, muziek streaming
- `editor.html` - Audio editor met 31 effects, volledige bewerkingsmogelijkheden
- `contests.html` - Producer battles met stemmen en leaderboard
- `live.html` - Live streaming kanalen met chat
- `serve.py` - Flask server (start API + static files)
- `api_server.py` - Flask API voor projecten en sound library
- `freesound_import.py` - Freesound API import tool
- `worklets/` - AudioWorklet processors (meter, gain)
- `sql/` - PostgreSQL schema
- `audio/` - Audio bestanden (gitignored)

## Database
PostgreSQL database `daw`, user `postgres`, pw `postgres`:
- `categories` - Sound categorieen
- `sounds` - Audio metadata (tags, BPM, key, waveform peaks)
- `projects` - DAW sessies (project_data als JSONB)

## Key Features (maart 2026)
- **DAW**: Timeline, transport, mixer met VU meters, rotary knobs, 3-band EQ, master channel
- **Mixer**: Drag & drop van library naar timeline met positie-gebaseerde plaatsing, ghost preview, grid snap
- **DJ App**: Twee decks, crossfader, effecten, Jamendo/Freesound/Internet Archive muziek, audio proxy voor CORS
- **Audio Editor**: 31 effects, cut/copy/paste, spectrum, spectrogram, WAV export
- **Contests**: Producer battles, voting, leaderboard
- **Live**: Streaming kanalen, chat
- **Improvisatie-engine**: 18 toonladders, 12 progressies, muziektheorie (voice leading, motivic development, chord-scale theory, tension/resolution)
- **Ensemble Improvisatie**: 7 instrumenten (drums, bass, gitaar, piano, lead, strings, brass) spelen samen met solo/mute per instrument
- **Library**: Metadata filters (BPM, toonsoort, formaat, duur), categorie chips, sorteren
- **Audio Proxy**: `/api/proxy/audio` voor CORS-vrij laden van externe audio
- **API Keys**: Jamendo `d14314a3` in dj.html, Freesound in `.env`

## Let op
- Audio bestanden staan in .gitignore
- Web Audio API vereist user interaction voordat AudioContext start
- AudioWorklet files moeten als aparte JS bestanden geladen worden
- Port 8086 (geen conflict met andere projecten)
- Freesound API key in `.env`
