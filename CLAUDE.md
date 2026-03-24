# DAW - Claude Code Instructies

## Project
Web-based muziekproductie platform met 8 pagina's.
Locatie: `E:\scripts\webscraper\CBSbuurt\daw\`
GitHub: AnneVersion/daw
GitHub Pages: https://anneversion.github.io/daw/

## Starten
```bash
python serve.py  # Start Flask API + static files: http://localhost:8086
```

## Branch-strategie
- **main** = stabiel/productie + GitHub Pages
- **develop** = dagelijkse ontwikkeling (standaard werkbranch)
- **feature/*** = nieuwe features, maak aan vanuit develop
- Na elke commit: push develop → merge naar main → push main

## Pagina's
| Pagina | URL | Beschrijving |
|--------|-----|-------------|
| `index.html` | `/` | DAW Studio - Multi-track timeline, mixer, library sidebar, MIDI import |
| `editor.html` | `/editor.html` | Audio Editor - 31 effects, cut/copy/paste, spectrum, WAV export |
| `sampler.html` | `/sampler.html` | MPC Sampler - 16 pads, step sequencer, ADSR, chaos mode, 9 FX |
| `improvisator.html` | `/improvisator.html` | Improvisator - 17 instrumenten, 14 stijlen, formant zang, MIDI export |
| `vocals.html` | `/vocals.html` | Vocals - Real-time mic effecten, autotune, vocoder, pitch shift |
| `community.html` | `/community.html` | Community - Contests + Live streaming + DJ link |
| `dj.html` | `/dj.html` | DJ App - Twee decks, crossfader, FX, broadcasting (via Community) |
| `live.html` | `/live.html` | Live - WebRTC luisteren, Twitch/YouTube embed, broadcast chat |

## Architectuur

### Bestanden
- `index.html` - DAW Studio (single-file, ~10.000 regels)
- `dj.html` - DJ App (single-file, ~3.900 regels)
- `editor.html` - Audio Editor (single-file, ~1.200 regels)
- `sampler.html` - MPC Sampler (single-file, ~3.800 regels)
- `contests.html` - Producer Contests
- `live.html` - Live Streaming + WebRTC listener
- `audio-browser.js` - **Herbruikbare module**: sample zoeken in Freesound, Jamendo, Archive, Community, lokaal
- `library-panel.js` - **Herbruikbare module**: library met tabs (Library, Opnames, Zoek Online), filters, categorieën
- `dc-logo.svg` - Data Consultants logo (in alle nav bars)
- `serve.py` - Flask server (start API + static files)
- `api_server.py` - Flask API voor projecten en sound library
- `freesound_import.py` - Freesound API import tool
- `worklets/` - AudioWorklet processors (meter, gain)
- `sql/` - PostgreSQL schema + migraties
- `audio/` - Audio bestanden (gitignored)

### Classes
| Pagina | Class | Verantwoordelijkheid |
|--------|-------|---------------------|
| index.html | `AudioEngine` | Web Audio API, scheduling, opname |
| index.html | `TimelineRenderer` | Canvas 2D timeline rendering |
| index.html | `DAWController` | Hoofd controller, events, state |
| dj.html | `DJApp` | Decks, mixer, FX, broadcast, opname |
| sampler.html | `SamplerApp` | Pads, sequencer, ADSR, FX |
| - | `AudioBrowser` | Multi-source sample zoeken (module) |
| - | `LibraryPanel` | Library UI met filters (module) |

## Database
PostgreSQL database `daw`, user `postgres`, pw `postgres`:
- `categories` - Sound categorieën
- `sounds` - Audio metadata (tags, BPM, key, waveform peaks)
- `projects` - DAW sessies (project_data als JSONB)

## Key Features (maart 2026)

### Navigatie & Branding
- **DC logo** in alle 6 pagina's navigatie (dc-logo.svg)
- **Material Icons** per nav link (piano, radio, graphic_eq, library_music, emoji_events, live_tv)
- **Consistent styling** met active state markering
- **Responsieve nav** met hamburger menu (contests, live, sampler)

### DAW Studio (index.html)
- Timeline, transport, mixer met VU meters, rotary knobs, 3-band EQ, master channel
- Drag & drop van library naar timeline met positie-gebaseerde plaatsing, ghost preview, grid snap
- Library rechts: metadata filters (BPM, toonsoort, formaat, duur), categorie chips, sorteren, favorieten
- Synth keyboard: 2-octaaf piano, klik + drag + PC keyboard (A-L)
- Synth improvisatie: key, scale (12 soorten), style, BPM, octaaf, density
- MIDI export: opnemen → download .mid
- Audio opname: MediaRecorder → download .webm

### DJ App (dj.html)
- Twee decks, crossfader, 3-band EQ per deck
- FX per deck: Echo, Reverb, Flanger, Filter, Phaser, Bitcrusher, Distortion
- Master FX knoppen: phaser, flanger, crush, dist
- SFX: Toeter (5 types), witte ruis
- Scratch: sleep over plattenspeler (mouse + touch)
- FX Presets: opslaan/laden/reset (localStorage)
- Rad van Fortuin: random FX + EQ + genre
- DJ Sampler: upload sample, 8 pitch pads
- Record: master output als .webm
- **WebRTC Broadcast**: stream master audio naar luisteraars (P2P via Supabase Realtime signaling)
- **ON AIR bar**: broadcast code, luisteraar teller, kopieer link, stop knop
- **Broadcast modal**: 6-letter code + deelbare link bij start

### Audio Editor (editor.html)
- Waveform display, transport, loop
- 31 audio effecten
- Cut/copy/paste selectie
- Spectrum & spectrogram visualisatie
- WAV export
- **Browse knop**: AudioBrowser module in modal
- **Library knop**: LibraryPanel module in modal
- Scan PC: zoek en laad lokale audio

### Sampler (sampler.html)
- 16 pads (4x4 grid), ADSR envelope, volume, pan, pitch per pad
- Step sequencer: 8/16/32/64 steps, 4 patterns (A/B/C/D), BPM, swing
- Choke groups, reverse, one-shot/loop modes
- Keyboard mapping: Q/W/E/R, A/S/D/F, Z/X/C/V, 1/2/3/4
- Pad context menu: opnemen (mic), geluid kiezen (file), sample browser, pad wissen
- Genre presets: reggae, dub, hiphop, house, dnb, trap, bossa, funk, rock, afrobeat
- Master FX: Reverb, Delay, Filter, Compressor
- Drag & drop audiobestand op pad
- Scratch: sleep over waveform panel
- **Community knop**: AudioBrowser module (Freesound/Jamendo/Archive/Community)
- **Library knop**: LibraryPanel module (lokale sounds, opnames, online zoeken)
- Export: WebM, WAV, MIDI
- Community delen: Upload Pad, Upload Opname, Deel Pattern, Deel FX Preset

### Live (live.html)
- **WebRTC luisteren**: voer broadcast code in of gebruik ?listen=CODE link
- **Twitch/YouTube embed**: plak URL → embedded player
- **Actieve Broadcasts grid**: ontdekt echte WebRTC broadcasts via Supabase
- **"Start je eigen broadcast"** kaart → linkt naar DJ pagina
- **Realtime chat** per broadcast via Supabase channel
- **Geen dummy data** — alles is echt

### Improvisatie Engine (index.html)
- **18 toonladders**: major, minor, dorian, mixolydian, pentatonic, blues, phrygian, lydian, locrian, harmonic_minor, melodic_minor, whole_tone, diminished, bebop, hungarian, japanese, minor_pent, altered
- **12 progressies**: pop, jazz, jazz2, jazz3, blues, funk, sad, spanish, rock, neosoul, gospel, bossa
- **Chord-Scale mapping**: welke toonladders passen bij welk akkoordtype
- **Voice leading**: stepwise motion, chord tone emphasis, leading tone resolution, tritone resolution, phrase arc
- **Tension/resolution**: 4-fase arc (intro→development→climax→outro)
- **Motief development**: repeat, transpose, inversion, augmentation, diminution, sequence
- **17 ensemble instrumenten** in 6 categorieën:
  - Ritme: drums, bongo's, congas, shaker/tamboerijn
  - Bas: e-bass, contrabas
  - Harmonie: gitaar, piano, orgel, vibrafoon
  - Melodie: lead synth, fluit, saxofoon
  - Strijkers & Blazers: strings, brass
  - Vocaal: koor (formant), scat
- **Formant synthese**: vocale klanken via bandpass filters (F1/F2/F3 per klinker)
- **Scat vocals**: bebop scat met syllaben, voice leading, call & response
- **Rad van Fortuin**: random stijl/toonsoort/toonladder/instrumenten

### Herbruikbare Modules

#### audio-browser.js (AudioBrowser)
Multi-source sample zoeken, preview, en laden.
```javascript
new AudioBrowser({
    container: document.getElementById('my-container'),
    onSelect: (audioBuffer, name) => { /* gebruik het */ },
    compact: false
});
```
- **Bronnen**: Freesound, Jamendo, Internet Archive, Community (Supabase), Lokaal
- **18 categorie knoppen**: Kick, Snare, Hi-Hat, Clap, Bass, Gitaar, Piano, Trompet, Sax, Strings, Synth, Vocals, Vogels, Dieren, Natuur, FX, Reggae, Conga
- **Preview**: luister voor je laadt (5s auto-stop)
- **Source toggles**: elke API aan/uit
- **Geïntegreerd in**: sampler.html, editor.html

#### library-panel.js (LibraryPanel)
Lokale library met 3 tabs en filters.
```javascript
new LibraryPanel({
    container: document.getElementById('my-container'),
    onSelect: (url, name, metadata) => { /* gebruik het */ },
    onSelectBuffer: (audioBuffer, name) => { /* voor sampler */ },
    showFilters: true, showCategories: true, showRecordings: true
});
```
- **Tab Library**: lokale sounds uit PostgreSQL (/api/sounds), filters (categorie, BPM, duur)
- **Tab Opnames**: eigen opnames uit localStorage, beheer (verwijderen)
- **Tab Zoek Online**: AudioBrowser module embedded
- **Scan PC**: zoek audio op alle schijven
- **Auto-save**: `LibraryPanel.saveRecording(name, url, duration)` vanuit elke pagina
- **Geïntegreerd in**: editor.html, sampler.html (Studio heeft eigen ingebouwde library)

## WebRTC Broadcast Systeem

### Hoe het werkt
1. **DJ** opent `dj.html` → klikt **Live** knop
2. Master audio output wordt gestreamd via `MediaStreamDestination`
3. **Supabase Realtime** channel `broadcast-{CODE}` voor signaling (offer/answer/ICE)
4. **ON AIR bar** verschijnt met code, luisteraar count, stop knop
5. **Luisteraar** opent `live.html` → voert code in of gebruikt `?listen=CODE` link
6. WebRTC peer connection → audio stream → `<audio>` element
7. **Chat** via Supabase Realtime channel `broadcast-chat-{CODE}`

### Technisch
- **STUN servers**: stun.l.google.com:19302, stun1.l.google.com:19302
- **Signaling**: Supabase Realtime (gratis tier)
- **Max luisteraars**: ~10-20 (P2P, elke luisteraar = aparte connection)
- **Geen TURN server**: werkt alleen op zelfde netwerk of als NAT traversal lukt

## Externe Audio API's

| API | Type | Key | CORS | Proxy nodig | Beschikbaar op |
|-----|------|-----|------|-------------|----------------|
| **Freesound** | Samples, loops, FX | `.env` FREESOUND_API_KEY | Nee | Ja (localhost) | Studio, DJ, Sampler, Editor |
| **Jamendo** | Volledige tracks | `d14314a3` hardcoded | Ja | Nee | DJ, Sampler, Editor |
| **Internet Archive** | CC muziek, audio | Geen | Ja | Nee | DJ, Sampler, Editor |
| **Free Music Archive** | CC tracks | Geen (via Archive) | Ja | Nee | DJ |
| **Supabase Community** | Gedeelde samples | anon key in code | Ja | Nee | DJ, Sampler, Editor |
| **Lokale bestanden** | PC audio scan | Geen | N/A | N/A | Alle pagina's |

## Supabase Community Platform
Alles wat gebruikers maken is beschikbaar voor iedereen. Geen login nodig.

### Supabase tabellen
| Tabel | Wat | Opslag | SQL |
|-------|-----|--------|-----|
| `community_samples` | Samples, one-shots, loops | `samples/` bucket | `sql/03_community_samples.sql` |
| `community_tracks` | Nummers, mixes, DJ sets | `samples/tracks/` | `sql/04_supabase_community.sql` |
| `community_patterns` | Step sequencer patterns (JSON) | — | `sql/04_supabase_community.sql` |
| `community_presets` | Synth/FX/mixer presets (JSON) | — | `sql/04_supabase_community.sql` |
| `community_projects` | DAW projecten (JSON) | `samples/previews/` | `sql/04_supabase_community.sql` |
| `community_likes` | Likes per content item | — | `sql/04_supabase_community.sql` |

### Supabase Realtime Channels
| Channel | Gebruik | Pagina |
|---------|---------|--------|
| `broadcast-{CODE}` | WebRTC signaling (offer/answer/ICE) | DJ, Live |
| `broadcast-chat-{CODE}` | Live chat tijdens broadcast | Live |
| `broadcast-discovery` | Announce/signoff voor actieve broadcasts | Live |

## Audio Scanner
- `/api/scan-audio` - Scant alle schijven (C:/Users, D:/, E:/, F:/)
- `/api/local-audio?path=...` - Serveert lokale audio bestanden
- 34 audio formaten (mp3, wav, flac, midi, aac, etc.)
- Beschikbaar op alle pagina's via LibraryPanel of direct

---

## Startup Checklist

Bij het opstarten van de website, controleer het volgende:

### 1. Server & API
- [ ] `python serve.py` start zonder errors op port 8086
- [ ] PostgreSQL draait (`daw` database bereikbaar)
- [ ] `http://localhost:8086/` laadt index.html
- [ ] `/api/projects` retourneert JSON (200 OK)
- [ ] `/api/sounds` retourneert JSON (200 OK)
- [ ] `/api/categories` retourneert JSON (200 OK)
- [ ] `/api/scan-audio?path=audio` retourneert resultaten
- [ ] `/api/local-audio?path=...` serveert audio bestand (200 OK)
- [ ] `/api/proxy/audio?url=...` proxyt externe audio

**Test commando's:**
```bash
curl -s http://localhost:8086/api/sounds | python -c "import sys,json;d=json.load(sys.stdin);print(f'{len(d)} sounds')"
curl -s http://localhost:8086/api/categories | python -c "import sys,json;d=json.load(sys.stdin);print(f'{len(d)} categories')"
curl -s http://localhost:8086/api/scan-audio?path=audio | python -c "import sys,json;d=json.load(sys.stdin);print(f'{len(d.get(\"results\",[]))} files')"
```

### 2. Pagina's laden (geen JS console errors)
- [ ] `/` — Studio: timeline, mixer, transport, library zichtbaar
- [ ] `/dj.html` — DJ: 2 decks, crossfader, Live broadcast knop, browser tabs
- [ ] `/editor.html` — Editor: toolbar (incl. Browse + Library knoppen), waveform canvas
- [ ] `/sampler.html` — Sampler: 16 pads, sequencer, Community + Library knoppen
- [ ] `/contests.html` — Contests: battle cards, voting UI
- [ ] `/live.html` — Live: broadcast luister-panel, Twitch/YouTube embed, actieve broadcasts grid

**Test:** Open elke pagina in browser → F12 → Console → geen rode errors

### 3. Navigatie & Branding
- [ ] Alle 6 pagina's hebben DC logo (dc-logo.svg) in nav bar
- [ ] Alle 6 pagina's hebben Material Icons per nav link
- [ ] Alle 6 nav links werken en verwijzen naar juiste pagina
- [ ] Actieve pagina is gehighlight (accent kleur + achtergrond)

**Test:** Klik door alle 6 pagina's, controleer logo + highlighting

### 4. DAW Studio (index.html)
- [ ] AudioContext initialiseert na eerste klik
- [ ] Timeline rendert (Canvas)
- [ ] Mixer: VU meters, rotary knobs, 3-band EQ werken
- [ ] Library panel rechts: categorieën laden, filters werken
- [ ] Drag & drop van library naar timeline
- [ ] Improvisatie: kies stijl/toonsoort → play → instrumenten spelen
- [ ] Ensemble: meerdere instrumenten tegelijk (solo/mute per instrument)
- [ ] Rad van Fortuin: draait, kiest random instellingen, auto-start
- [ ] MIDI export: opname → download .mid
- [ ] Audio opname: record → download .webm
- [ ] Scan PC knop in library vindt audio bestanden
- [ ] Synth keyboard: noten klikbaar + PC keyboard (A-L)

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
- [ ] Opname: record knop → pulserend rood → download .webm
- [ ] **Broadcast**: Live knop → ON AIR bar verschijnt → code + link
- [ ] **Broadcast stop**: Stop knop → bar verdwijnt
- [ ] **Luisteraar count**: wordt bijgewerkt in bar + status

**Broadcast test:**
1. Open dj.html, klik Live → noteer code
2. Open live.html in ander tabblad → voer code in → Verbinden
3. Speel muziek op DJ → hoor je het op Live?
4. Stop broadcast → bar verdwijnt

### 6. Audio Editor (editor.html)
- [ ] Waveform display na laden audio bestand
- [ ] Transport: play, stop, loop
- [ ] Effects toepassen (31 effecten beschikbaar)
- [ ] Cut/copy/paste selectie
- [ ] Spectrum & spectrogram visualisatie
- [ ] WAV export
- [ ] **Browse knop**: opent AudioBrowser modal → zoek + laad audio
- [ ] **Library knop**: opent LibraryPanel modal → 3 tabs werken
- [ ] Scan PC: zoek en laad audio bestanden

### 7. Sampler (sampler.html)
- [ ] 16 pads renderen (4x4 grid)
- [ ] Keyboard: Q/W/E/R, A/S/D/F, Z/X/C/V, 1/2/3/4 triggeren pads
- [ ] Laad Sample: file picker → pad krijgt naam + waveform
- [ ] Drag & drop audiobestand op pad
- [ ] Pad klikken → sample speelt af
- [ ] ADSR envelope: sliders + visualisatie
- [ ] Volume, pan, pitch controls per pad
- [ ] Choke groups: pads in zelfde groep stoppen elkaar
- [ ] One-shot / Loop / Reverse modes
- [ ] Scratch: sleep over waveform panel
- [ ] Step sequencer: klik steps aan/uit, rechtermuisklik = velocity
- [ ] 8/16/32/64 steps selecteerbaar
- [ ] BPM, swing instelbaar
- [ ] Play/stop sequencer (spatie)
- [ ] 4 patterns (A/B/C/D) wisselen
- [ ] Genre presets: reggae, dub, hiphop, house, dnb, trap, bossa, funk, rock, afrobeat
- [ ] Master FX: reverb, delay, filter, compressor
- [ ] **Community knop**: AudioBrowser panel → zoeken in alle bronnen → laad op pad
- [ ] **Library knop**: LibraryPanel → 3 tabs → laad op pad
- [ ] Export: WebM / WAV / MIDI dropdown werkt
- [ ] Pad context menu: rechtermuisklik → opnemen, kiezen, browser, wissen

### 8. Live (live.html)
- [ ] **Broadcast luisteren**: code invoer + Verbinden knop
- [ ] **Auto-connect**: `?listen=CODE` in URL → auto-verbinding
- [ ] **Twitch embed**: plak twitch.tv/kanaal → video speelt
- [ ] **YouTube embed**: plak youtube.com/watch URL → video speelt
- [ ] **Actieve broadcasts**: grid toont beschikbare streams (of "geen broadcasts")
- [ ] **Broadcast chat**: berichten versturen/ontvangen tijdens verbinding
- [ ] **Geen dummy data**: alles is echt, geen fake kanalen

### 9. Externe diensten
- [ ] Supabase: community samples ophaalbaar (anon key in dj.html + sampler.html)
- [ ] Jamendo API: tracks zoeken vanuit DJ/Sampler/Editor (`d14314a3`)
- [ ] Freesound API: zoeken werkt (key in `.env`, alleen via proxy op localhost)
- [ ] Internet Archive: zoeken werkt (geen key nodig)
- [ ] Audio proxy: `/api/proxy/audio` voor CORS-blocked bronnen

### 10. Herbruikbare Modules
- [ ] `audio-browser.js` laadt zonder errors (check: `typeof AudioBrowser === 'function'`)
- [ ] `library-panel.js` laadt zonder errors (check: `typeof LibraryPanel === 'function'`)
- [ ] AudioBrowser in sampler: Community knop → panel opent → categorieën klikbaar → preview werkt
- [ ] AudioBrowser in editor: Browse knop → modal opent → zoeken werkt
- [ ] LibraryPanel in sampler: Library knop → panel opent → 3 tabs zichtbaar
- [ ] LibraryPanel in editor: Library knop → modal opent → 3 tabs zichtbaar

### 11. GitHub Pages (anneversion.github.io/daw)
- [ ] Alle pagina's laden (geen 404)
- [ ] Navigatie werkt tussen pagina's
- [ ] DC logo zichtbaar op alle pagina's
- [ ] Jamendo zoeken werkt (CORS OK)
- [ ] Internet Archive zoeken werkt (CORS OK)
- [ ] Freesound zoeken WERKT NIET (CORS blocked, verwacht gedrag)
- [ ] Lokale API's niet beschikbaar (verwacht: fallback meldingen)
- [ ] Broadcast Live knop werkt (Supabase signaling is extern)

---

## TODO — Bugs & Issues

### Studio (index.html)
- [ ] Projecten opslaan/laden (laatste project automatisch laden bij openen)
- [ ] Gitaarhals panel testen
- [ ] Piano keyboard — alle noten klikbaar + geluid via synth/soundfont

### Sampler (sampler.html)
- [ ] Opname workflow testen (Neem Op → Stop → klik pad)

### Algemeen
- [ ] Camera + mic in broadcast (video boven chat, commentaar)
- [ ] Broadcast state persistent houden tot app echt gesloten wordt
- [ ] Supabase tabellen aanmaken: sql/04_supabase_community.sql uitvoeren
- [ ] Alle pagina's testen op GitHub Pages

### Afgerond (23-24 maart 2026)
- [x] Drum improvisatie: rudiments (flam/drag), meerdere fill varianten per stijl
- [x] Reggae improvisatie: walking bass, muted chika skank, dubbele piano bubble
- [x] Random FX per pad: 9 effecten (reverse, pitch, filter, echo, halfspeed, stutter, bitcrush, ringmod, tapestop)
- [x] MIDI regio tekenen: dubbelklik op MIDI track maakt region + opent piano roll
- [x] Library sidebar rechts met AudioBrowser (12 bronnen, 500K+ tracks)
- [x] Sampler: opgeruimd, context menu met afspelen/stoppen
- [x] 7 instrument synths: sax, fluit, orgel, vibrafoon, contrabas, strings, brass
- [x] MIDI parser + import + playback (BitMidi API, per-kanaal tracks)
- [x] Drag & drop van library naar timeline (audio + MIDI)
- [x] Opnames in IndexedDB (permanent, werkt op GitHub Pages)
- [x] Loop resize: grotere handles, cursor feedback
- [x] MIDI noten zichtbaar in regio's + noot-count
- [x] Regio context menu: verwijderen, dupliceren, hernoemen
- [x] BPM sync per audio regio (time-stretch)
- [x] Mixer faders groter (100px hoog)
- [x] improvisator.html: standalone improvisatie app (2769 regels)
- [x] vocals.html: real-time mic effecten, autotune, vocoder (1439 regels)
- [x] community.html: contests + live gecombineerd (407 regels)
- [x] Navigatie herstructurering: Studio|Editor|Sampler|Improvisator|Vocals|Community
- [x] Rad van Fortuin tik-geluid in DJ app
- [x] 12 audio bronnen: Freesound, Jamendo, Archive, BBC, BitMidi, ccMixter, Deezer, Netlabels, FMA, Vintage 78rpm, Community, Opnames

---

## Testscript — Handmatige Testprocedure

### Test 1: Studio laden (index.html)
```
1. Open http://localhost:8086/ (of GitHub Pages)
2. VERWACHT: 4 tracks (Audio 1, Audio 2, Piano, Drums), mixer onderaan, Library sidebar rechts
3. Klik ergens op de pagina → AudioContext initialiseert
4. VERWACHT: "DAW geladen" toast, Library sidebar toont geluiden (lokaal) of "geen geluiden" (GitHub Pages)
5. CHECK: Library knop rechtsboven is groen highlighted
6. Klik Library knop → sidebar sluit. Klik opnieuw → sidebar opent
```

### Test 2: MIDI regio tekenen
```
1. Dubbelklik op de Piano track timeline (ergens bij beat 1-2)
2. VERWACHT: groene MIDI regio verschijnt (4 beats breed), piano roll opent onderaan
3. Klik noten in de piano roll
4. VERWACHT: noten verschijnen IN de MIDI regio op de timeline (niet erboven/erbuiten!)
5. Druk Play → VERWACHT: noten klinken op het juiste moment
6. BUG CHECK: als noten boven de regio verschijnen → MIDI note Y-positie berekening is fout
```

### Test 3: Loop resize
```
1. Klik en sleep in de ruler bovenaan om een loop te maken (blauw gebied)
2. VERWACHT: blauwe loop markers verschijnen
3. Sleep de rechter loop-rand naar rechts om de loop breder te maken
4. VERWACHT: loop wordt langer, playback herhaalt het nieuwe bereik
5. BUG CHECK: als de rand niet versleepbaar is → loop resize event handler ontbreekt
```

### Test 4: Library sidebar drag & drop
```
1. Open Library sidebar (klik Library knop)
2. VERWACHT: geluiden lijst met naam, categorie, duur
3. Klik een categorie chip (bijv. "Drums") → VERWACHT: gefilterde lijst
4. Sleep een geluid van de sidebar naar de Audio 1 track timeline
5. VERWACHT: audio region verschijnt op de timeline waar je loslaat
6. Druk Play → VERWACHT: geluid speelt op het juiste moment
```

### Test 5: Improvisatie engine
```
1. Klik tab "Improvisatie" onderaan
2. Kies stijl: Jazz, toonsoort: C, toonladder: Major
3. Zet instrumenten aan: drums, bass, piano, gitaar
4. Klik Play
5. VERWACHT: complete band speelt samen, stijl-specifiek (jazz = ride cymbal, walking bass)
6. Wissel naar Reggae → VERWACHT: one-drop drums, skank gitaar, bubble piano
7. Typ tekst in het "Zang tekst" veld → VERWACHT: koor/scat zingt de woorden
8. Klik "Rad van Fortuin" → VERWACHT: random stijl/toonsoort/instrumenten
```

### Test 6: Instrumenten panel
```
1. Klik tab "Instrumenten" onderaan
2. VERWACHT: Piano keyboard (2 octaven) + gitaarhals zichtbaar
3. Klik piano toetsen → VERWACHT: noten klinken (soundfont of synth)
4. PC keyboard A-L → VERWACHT: noten klinken
5. Gitaar strum patterns (Funk, Reggae, Pop, Rock) → klik een pattern → VERWACHT: gitaar speelt
```

### Test 7: Sampler (sampler.html)
```
1. Open http://localhost:8086/sampler.html
2. VERWACHT: 16 lege pads, pad controls (Laad Sample, Library, Scan PC, Wis)
3. Klik "Laad Sample Kit..." dropdown → kies "Drums"
4. VERWACHT: samples laden via API (lokaal) of Jamendo (GitHub Pages)
5. Klik pad 1 → VERWACHT: sample speelt af
6. Klik "Chaos" → klik pads → VERWACHT: random FX (pitch, reverse, echo, etc.)
7. Rechtermuisklik pad → VERWACHT: context menu met "Afspelen", "Stoppen", "Opnemen", etc.
8. Klik "Neem Op" → sta mic toe → spreek in → klik "Stop" → klik een pad
9. VERWACHT: opname geladen op pad, pad naam = "Opname HH:MM:SS"
```

### Test 8: DJ App (dj.html)
```
1. Open http://localhost:8086/dj.html
2. VERWACHT: 2 decks, crossfader, FX knoppen
3. Zoek een track (Jamendo tab) → dubbelklik om te laden op deck A
4. Klik Play op deck A → VERWACHT: muziek speelt
5. Scratch: sleep over de draaitafel → VERWACHT: scratch geluid
6. FX: klik Echo aan → VERWACHT: echo effect hoorbaar
7. Live knop → VERWACHT: broadcast code verschijnt in ON AIR bar
```

### Test 9: Audio Editor (editor.html)
```
1. Open http://localhost:8086/editor.html
2. Klik Browse/Library → VERWACHT: modal opent met zoeken
3. Laad een audio bestand
4. VERWACHT: waveform verschijnt
5. Selecteer een gedeelte → klik Cut → VERWACHT: selectie verwijderd
6. Klik effect (bijv. Reverb) → Apply → VERWACHT: effect toegepast
```

### Test 10: Live + Broadcast (live.html + dj.html)
```
1. Open dj.html → klik Live knop → noteer broadcast code
2. Open live.html in nieuw tabblad → voer code in → klik Verbinden
3. Speel muziek op DJ → VERWACHT: muziek hoorbaar op Live pagina
4. VERWACHT: chat berichten kunnen verstuurd worden
5. Stop broadcast op DJ → VERWACHT: ON AIR bar verdwijnt
```

### Test 11: Navigatie (alle pagina's)
```
1. Open elke pagina: Studio, DJ, Editor, Sampler, Contests, Live
2. VERWACHT: DC logo in navbar, alle 6 links werken, actieve pagina highlighted
3. Hamburger menu op mobiel (< 768px) → VERWACHT: menu opent/sluit
```

### Test 12: GitHub Pages
```
1. Open https://anneversion.github.io/daw/
2. VERWACHT: Studio laadt zonder errors
3. CHECK: Library sidebar toont "geen geluiden" (normaal, geen backend)
4. CHECK: Improvisatie werkt volledig (browser-only, geen API nodig)
5. CHECK: Sampler laadt, Jamendo samples beschikbaar via "Laad Sample Kit"
6. CHECK: DJ app kan Jamendo tracks zoeken en afspelen
7. CHECK: Navigatie tussen alle 6 pagina's werkt
```

## Let op
- Audio bestanden staan in .gitignore
- Web Audio API vereist user interaction voordat AudioContext start
- AudioWorklet files moeten als aparte JS bestanden geladen worden
- Port 8086 (geen conflict met andere projecten)
- Freesound API key in `.env`
- NOOIT de improvisatie wiskunde (voice leading, chord-scale theory, tension arc) verwijderen of versimpelen
- GitHub Pages draait op `main` branch — altijd mergen na develop push
