# DAW - Claude Code Instructies

## Project
Web-based muziekproductie platform met 6 pagina's.
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
| `sampler.html` | `/sampler.html` | MPC Sampler - 16 pads, step sequencer, ADSR, master FX |

## Architectuur
- `index.html` - DAW frontend (single-file)
  - `AudioEngine` class - Web Audio API, scheduling, opname
  - `TimelineRenderer` class - Canvas 2D rendering
  - `DAWController` class - Hoofd controller, events, state management
- `dj.html` - DJ App met dual decks, crossfader, effecten, muziek streaming
- `editor.html` - Audio editor met 31 effects, volledige bewerkingsmogelijkheden
- `contests.html` - Producer battles met stemmen en leaderboard
- `live.html` - Live streaming kanalen met chat
- `sampler.html` - MPC-style sampler met `SamplerApp` class
  - 16 pads (4x4 grid), elk met eigen sample, ADSR, volume, pan, pitch
  - Step sequencer (16 steps), 4 patterns (A/B/C/D), BPM, swing
  - Choke groups, reverse, one-shot/loop modes
  - Master FX: Reverb, Delay, Filter, Compressor
  - Keyboard mapping: Q/W/E/R, A/S/D/F, Z/X/C/V, 1/2/3/4
  - Drag & drop samples, PC scan, Community Samples (Supabase)
  - Opname naar .webm, pattern opslag in localStorage
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
- **DJ Scratch**: sleep over plaat om te scratchen (mouse + touch), -3x tot +3x rate
- **DJ FX Presets**: opslaan/laden effect combinaties (localStorage), Reset FX knop
- **Community Samples**: Supabase Storage + PostgreSQL, upload/download/zoek gedeelde samples
- **Community SQL**: `sql/03_community_samples.sql` — tabel + RLS policies + storage bucket
- **Supabase credentials**: worden gevraagd bij eerste gebruik, opgeslagen in localStorage
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

## Startup Checklist
Bij het opstarten van de website, controleer het volgende:

### 1. Server & API
- [ ] `python serve.py` start zonder errors op port 8086
- [ ] PostgreSQL draait (`daw` database bereikbaar)
- [ ] `http://localhost:8086/` laadt index.html
- [ ] `/api/projects` retourneert JSON (200 OK)
- [ ] `/api/sounds` retourneert JSON (200 OK)
- [ ] `/api/categories` retourneert JSON (200 OK)
- [ ] `/api/scan-audio?path=audio` retourneert resultaten (104+ bestanden)
- [ ] `/api/local-audio?path=...` serveert audio bestand (200 OK)
- [ ] `/api/proxy/audio?url=...` proxyt externe audio

### 2. Pagina's laden (geen console errors)
- [ ] `/` — DAW Studio: timeline, mixer, transport zichtbaar
- [ ] `/dj.html` — DJ App: 2 decks, crossfader, browser tabs
- [ ] `/editor.html` — Audio Editor: toolbar, waveform canvas
- [ ] `/sampler.html` — Sampler: 16 pads, sequencer, genre preset dropdown
- [ ] `/contests.html` — Contests: battle cards, voting UI
- [ ] `/live.html` — Live: channel cards, chat panel

### 3. Navigatie
- [ ] Elke pagina heeft "Sampler" link in de nav bar
- [ ] Alle 6 nav links werken en verwijzen naar de juiste pagina
- [ ] Actieve pagina is gehighlight in de nav

### 4. DAW Studio (index.html)
- [ ] AudioContext initialiseert na eerste klik
- [ ] Timeline rendert (Canvas)
- [ ] Mixer: VU meters, rotary knobs, 3-band EQ werken
- [ ] Library: categorieen laden uit database
- [ ] Drag & drop van library naar timeline
- [ ] Improvisatie: kies stijl/toonsoort → play → instrumenten spelen
- [ ] Ensemble: meerdere instrumenten tegelijk (solo/mute per instrument)
- [ ] Rad van Fortuin: draait, kiest random instellingen, auto-start
- [ ] MIDI export: opname → download .mid
- [ ] Audio opname: record → download .webm
- [ ] Scan PC knop in library vindt audio bestanden

### 5. DJ App (dj.html)
- [ ] Deck A en B laden tracks (Jamendo, Internet Archive)
- [ ] Crossfader mengt tussen decks
- [ ] FX per deck: echo, reverb, flanger, filter, phaser, bitcrusher, distortion
- [ ] Master FX knoppen: phaser, flanger, crush, dist
- [ ] Toeter (5 types) en witte ruis werken
- [ ] Scratch: sleep over plattenspeler
- [ ] FX Presets: opslaan, laden, reset
- [ ] Rad van Fortuin: spin → random FX/EQ/genre
- [ ] DJ Sampler tab: upload sample, 8 pitch pads
- [ ] Community Samples tab: zoeken, laden via Supabase
- [ ] Opname: record knop → pulserend rood → download .webm
- [ ] BESTANDEN tab: scan PC, laad lokale bestanden

### 6. Audio Editor (editor.html)
- [ ] Waveform display na laden audio bestand
- [ ] Transport: play, stop, loop
- [ ] Effects toepassen (31 effecten)
- [ ] Cut/copy/paste selectie
- [ ] Spectrum & spectrogram visualisatie
- [ ] WAV export
- [ ] Scan PC: zoek en laad audio bestanden

### 7. Sampler (sampler.html)
- [ ] 16 pads renderen (4x4 grid)
- [ ] Keyboard mapping: Q/W/E/R, A/S/D/F, Z/X/C/V, 1/2/3/4
- [ ] Laad Sample: file picker → pad krijgt naam + waveform
- [ ] Library knop: laadt uit daw/audio folder (snel)
- [ ] Scan PC: scant alle schijven (duurt langer)
- [ ] Drag & drop audiobestand op pad
- [ ] Pad klikken → sample speelt af
- [ ] ADSR envelope: attack/decay/sustain/release sliders + visualisatie
- [ ] Volume, pan, pitch controls per pad
- [ ] Choke groups: pads in zelfde groep stoppen elkaar
- [ ] One-shot / Loop / Reverse modes
- [ ] Scratch: sleep over waveform panel
- [ ] Step sequencer: klik steps aan/uit, rechtermuisklik = velocity
- [ ] BPM, swing instelbaar
- [ ] Play/stop sequencer (spatie = play/stop)
- [ ] 4 patterns (A/B/C/D) wisselen
- [ ] Genre presets: reggae, dub, hiphop, house, dnb, trap, bossa, funk, rock, afrobeat
- [ ] Master FX: reverb, delay, filter, compressor (toggle + sliders)
- [ ] Opname: record → export .webm
- [ ] Opslaan: state naar localStorage
- [ ] Community samples: zoeken via Supabase

### 8. Contests (contests.html)
- [ ] Battle cards laden
- [ ] Voting UI werkt (stemknoppen)
- [ ] Leaderboard toont scores
- [ ] Nieuwe contest aanmaken (modal)

### 9. Live (live.html)
- [ ] Channel cards tonen
- [ ] Chat panel zichtbaar
- [ ] Stream controls aanwezig

### 10. Externe diensten
- [ ] Supabase: community samples ophaalbaar (anon key in dj.html + sampler.html)
- [ ] Jamendo API: tracks zoeken vanuit DJ (`d14314a3`)
- [ ] Freesound API: zoeken werkt (key in `.env`)
- [ ] Audio proxy: `/api/proxy/audio` voor CORS-blocked bronnen

## Let op
- Audio bestanden staan in .gitignore
- Web Audio API vereist user interaction voordat AudioContext start
- AudioWorklet files moeten als aparte JS bestanden geladen worden
- Port 8086 (geen conflict met andere projecten)
- Freesound API key in `.env`
- NOOIT de improvisatie wiskunde (voice leading, chord-scale theory, tension arc) verwijderen of versimpelen
