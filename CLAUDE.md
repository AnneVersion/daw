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
- **Audio Proxy**: `/api/proxy/audio` voor CORS-vrij laden van externe audio (localhost), fallback naar directe URL (GitHub Pages)
- **DJ SFX**: Toeter (5 types: airhorn/foghorn/sirene/laser/buzzer), witte ruis, master FX knoppen (phaser/flanger/crush/dist)
- **DJ FX per deck**: Echo, Reverb, Flanger, Filter, Phaser, Bitcrusher, Distortion
- **Track laden op GitHub Pages**: proxy fallback → directe URL (Jamendo/Archive werken, Freesound niet wegens CORS)
- **DJ FX Presets**: opslaan/laden van effect combinaties (localStorage)
- **DJ Rad van Fortuin**: random FX + EQ + genre selectie met spin animatie
- **DJ Sampler**: upload sample, 8 pitch pads (C-C+), play via master
- **DJ Opname**: record master output als .webm, pulserend rood tijdens opname
- **API Keys**: Jamendo `d14314a3` in dj.html, Freesound in `.env`

## Audio Scanner (maart 2026)
- `/api/scan-audio` - Scant alle schijven (C:/Users, D:/, E:/, F:/) voor audio bestanden
- `/api/local-audio?path=...` - Serveert lokale audio bestanden naar browser
- 34 audio formaten ondersteund (mp3, wav, flac, midi, aac, etc.)
- Geen limiet op resultaten, 2 minuten timeout
- Beschikbaar op: Studio (Scan PC knop in library), DJ (BESTANDEN tab), Editor (Scan PC in toolbar)

## Improvisatie Engine (index.html regels 4875-6700)
- **18 toonladders**: major, minor, dorian, mixolydian, pentatonic, blues, phrygian, lydian, locrian, harmonic_minor, melodic_minor, whole_tone, diminished, bebop, hungarian, japanese, minor_pent, altered
- **12 progressies**: pop, jazz, jazz2, jazz3, blues, funk, sad, spanish, rock, neosoul, gospel, bossa
- **Chord-Scale mapping**: welke toonladders passen bij welk akkoordtype
- **Voice leading**: stepwise motion, avoid augmented intervals, chord tone emphasis, leading tone resolution, tritone resolution, phrase arc, register management
- **Tension/resolution**: 4-fase arc (intro→development→climax→outro)
- **Motief development**: repeat, transpose, inversion, augmentation, diminution, sequence
- **17 ensemble instrumenten** in 6 categorieën:
  - Ritme: drums, bongo's, congas, shaker/tamboerijn
  - Bas: e-bass, contrabas
  - Harmonie: gitaar, piano, orgel, vibrafoon
  - Melodie: lead synth, fluit, saxofoon
  - Strijkers & Blazers: strings, brass
  - Vocaal: koor (formant), scat
- **Unified panel**: Solo + Ensemble samengevoegd — vink instrumenten aan, druk play
- **Sampler**: upload eigen sample, pitch per toets via playbackRate, improvisatie
- **MIDI export**: opnemen tijdens improvisatie → download .mid bestand
- **Audio opname**: MediaRecorder → download .webm bestand
- **Rad van Fortuin**: random stijl/toonsoort/toonladder/instrumenten, geanimeerd wiel, auto-start
- **Mixer FX**: EQ, Compressor, Reverb, Delay, Filter (LP/HP/BP/Notch), Distortion, Bitcrusher, Phaser, Flanger
- **Formant synthese**: vocale klanken via bandpass filters (F1/F2/F3 per klinker: A/O/E/I/U)
- **Scat vocals**: bebop scat improvisatie met syllaben (ba/da/dee/bop/doo/bee/bi/sha), voice leading, call & response
- **Per instrument**: on/off, solo, mute, volume
- **Style-specific**: swing, triplets, syncopation, density, ghost notes per stijl

## Let op
- Audio bestanden staan in .gitignore
- Web Audio API vereist user interaction voordat AudioContext start
- AudioWorklet files moeten als aparte JS bestanden geladen worden
- Port 8086 (geen conflict met andere projecten)
- Freesound API key in `.env`
- NOOIT de improvisatie wiskunde (voice leading, chord-scale theory, tension arc) verwijderen of versimpelen
