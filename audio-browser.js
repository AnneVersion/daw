// ============================================================
// AUDIO BROWSER MODULE - Herbruikbaar zoekpaneel voor alle pagina's
// Bronnen: Freesound, Jamendo, Internet Archive, Community (Supabase), Lokaal
//
// Gebruik:
//   const browser = new AudioBrowser({
//     container: document.getElementById('my-container'),
//     onSelect: (audioBuffer, name) => { /* doe iets met het geladen sample */ },
//     onSelectUrl: (url, name) => { /* doe iets met de URL (voor DJ decks) */ },
//     supabaseUrl: '...',
//     supabaseKey: '...',
//     freesoundKey: '...',
//     jamendoId: '...',
//     showLocalScan: true,   // toon Scan PC knop (alleen localhost)
//     compact: false,        // compact mode (minder categorie knoppen)
//   });
// ============================================================

class AudioBrowser {
    static _instanceCount = 0;

    constructor(options = {}) {
        this.container = options.container;
        this.onSelect = options.onSelect || (() => {});
        this.onSelectUrl = options.onSelectUrl || null;
        this.supabaseUrl = options.supabaseUrl || 'https://zdhwofuoefczrpkjhtjg.supabase.co';
        this.supabaseKey = options.supabaseKey || 'sb_publishable_Dd6tgVm-FJaV1uyfMBxElg_QNu9SQUb';
        this.freesoundKey = options.freesoundKey || 'oGR9eJ0TvJ67WKDAS1dT7GcUg2pewZC5LoPZHJ55';
        this.jamendoId = options.jamendoId || 'd14314a3';
        this.showLocalScan = options.showLocalScan !== false;
        this.compact = options.compact || false;
        this._supabase = null;
        this._results = [];
        this._audioCtx = null;
        this._previewSource = null;
        // Uniek ID per instantie zodat meerdere op 1 pagina werken
        this._id = 'ab' + (AudioBrowser._instanceCount++);
        this._recording = false;
        this._recorder = null;

        if (this.container) this.render();
    }

    _el(id) { return document.getElementById(`${this._id}-${id}`); }

    render() {
        const c = this.container;
        const id = this._id;
        c.innerHTML = '';
        c.style.cssText = 'background:var(--bg-panel,#161b22);border-radius:8px;padding:8px;font-family:inherit;';

        // Opname knop + Scan PC (actieknoppen bovenaan)
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:4px;margin-bottom:6px';
        actions.innerHTML = `
            <button id="${id}-rec-btn" style="display:flex;align-items:center;gap:4px;padding:5px 12px;background:#ef4444;border:none;border-radius:6px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s">
                <span class="material-icons" style="font-size:14px">mic</span> Opnemen
            </button>
            <span id="${id}-rec-status" style="font-size:10px;color:var(--text-dim,#8b949e);align-self:center;flex:1"></span>
            ${this.showLocalScan ? `<button id="${id}-scan-btn" style="padding:5px 10px;background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d);border-radius:6px;color:var(--text,#e0e0ee);font-size:10px;cursor:pointer">Scan PC</button>` : ''}
        `;
        c.appendChild(actions);

        // Source toggles (API's aan/uit)
        const toggles = document.createElement('div');
        toggles.style.cssText = 'display:flex;gap:3px;margin-bottom:6px;flex-wrap:wrap';
        const sources = [
            { sid: 'freesound', label: 'Freesound', color: '#4a9eff' },
            { sid: 'jamendo', label: 'Jamendo', color: '#ff8a4a' },
            { sid: 'archive', label: 'Archive', color: '#39ff14' },
            { sid: 'community', label: 'Community', color: '#a855f7' },
            { sid: 'recordings', label: 'Opnames', color: '#ef4444' },
        ];
        sources.forEach(src => {
            const label = document.createElement('label');
            label.style.cssText = 'font-size:9px;display:flex;align-items:center;gap:2px;cursor:pointer;padding:2px 6px;border-radius:4px;background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d)';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            cb.id = `${id}-src-${src.sid}`;
            cb.style.cssText = `width:12px;height:12px;accent-color:${src.color}`;
            label.appendChild(cb);
            label.appendChild(document.createTextNode(` ${src.label}`));
            toggles.appendChild(label);
        });
        c.appendChild(toggles);

        // Categorieën (gegroepeerd)
        const cats = document.createElement('div');
        cats.style.cssText = 'display:flex;gap:2px;margin-bottom:6px;flex-wrap:wrap';
        const catGroups = [
            // Drums & Percussie
            { q: 'kick drum', label: 'Kick', group: 'drums' },
            { q: 'snare drum', label: 'Snare', group: 'drums' },
            { q: 'hi-hat cymbal', label: 'Hi-Hat', group: 'drums' },
            { q: 'clap', label: 'Clap', group: 'drums' },
            { q: 'bongo conga percussion', label: 'Perc', group: 'drums' },
            // Instrumenten
            { q: 'bass guitar', label: 'Bass', group: 'inst' },
            { q: 'acoustic guitar', label: 'Gitaar', group: 'inst' },
            { q: 'piano chord', label: 'Piano', group: 'inst' },
            { q: 'trumpet brass', label: 'Blazers', group: 'inst' },
            { q: 'strings orchestra', label: 'Strings', group: 'inst' },
            { q: 'saxophone jazz', label: 'Sax', group: 'inst' },
            // Elektronisch
            { q: 'synth pad', label: 'Synth', group: 'elec' },
            { q: 'electronic loop beat', label: 'Loops', group: 'elec' },
            { q: 'vocal chop', label: 'Vocals', group: 'elec' },
            { q: 'sound effect boom', label: 'FX', group: 'elec' },
            // Sfeer
            { q: 'ambient nature rain', label: 'Natuur', group: 'sfeer' },
            { q: 'bird animal', label: 'Dieren', group: 'sfeer' },
        ];
        const groupColors = { drums: '#ef4444', inst: '#4a9eff', elec: '#a855f7', sfeer: '#39ff14' };
        catGroups.forEach(cat => {
            const btn = document.createElement('button');
            btn.textContent = cat.label;
            btn.style.cssText = `font-size:8px;padding:2px 7px;border-radius:3px;border:1px solid var(--border,#30363d);background:var(--bg-panel,#161b22);color:var(--text,#e0e0ee);cursor:pointer;transition:all .15s;border-left:2px solid ${groupColors[cat.group]}`;
            btn.onmouseover = () => { btn.style.background = 'var(--bg-hover,#242d3d)'; };
            btn.onmouseout = () => { if (!btn.classList.contains('active')) btn.style.background = 'var(--bg-panel,#161b22)'; };
            btn.onclick = () => {
                cats.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.style.background = 'var(--bg-panel,#161b22)'; });
                btn.classList.add('active');
                btn.style.background = groupColors[cat.group] + '33';
                this.search(cat.q);
            };
            cats.appendChild(btn);
        });
        c.appendChild(cats);

        // Zoekbalk
        const searchBar = document.createElement('div');
        searchBar.style.cssText = 'display:flex;gap:4px;margin-bottom:6px';
        searchBar.innerHTML = `
            <input type="text" id="${id}-search" placeholder="Zoek geluiden..." style="flex:1;background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d);border-radius:5px;color:var(--text,#e0e0ee);padding:5px 8px;font-size:11px;outline:none">
            <button id="${id}-search-btn" style="padding:5px 12px;background:var(--accent,#4a9eff);border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;cursor:pointer">Zoek</button>
        `;
        c.appendChild(searchBar);

        // Resultaten
        const results = document.createElement('div');
        results.id = `${id}-results`;
        results.style.cssText = 'max-height:400px;overflow-y:auto';
        c.appendChild(results);

        // Event bindings
        this._el('search').onkeydown = (e) => { if (e.key === 'Enter') this.search(); };
        this._el('search-btn').onclick = () => this.search();
        this._el('rec-btn').onclick = () => this.toggleRecording();
        if (this._el('scan-btn')) this._el('scan-btn').onclick = () => this.scanLocal();

        // Bij openen: laad meteen populaire geluiden
        setTimeout(() => this.search('drums loop'), 300);
    }

    // ---- Opname functie ----
    async toggleRecording() {
        const btn = this._el('rec-btn');
        const status = this._el('rec-status');
        if (this._recording) {
            // Stop
            this._recording = false;
            if (this._recorder && this._recorder.state === 'recording') this._recorder.stop();
            btn.innerHTML = '<span class="material-icons" style="font-size:14px">mic</span> Opnemen';
            btn.style.background = '#ef4444';
            btn.style.animation = '';
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this._recording = true;
            btn.innerHTML = '<span class="material-icons" style="font-size:14px">stop</span> Stop';
            btn.style.animation = 'pulse .8s infinite alternate';
            status.textContent = 'Opname bezig...';
            status.style.color = '#ef4444';

            const recorder = new MediaRecorder(stream);
            this._recorder = recorder;
            const chunks = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                this._recording = false;
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const name = 'Opname-' + new Date().toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit',second:'2-digit'}).replace(/:/g,'-');

                // Opslaan via API (als beschikbaar) of localStorage
                try {
                    const fd = new FormData();
                    fd.append('audio', blob, name + '.webm');
                    fd.append('name', name);
                    const resp = await fetch('/api/recordings', { method: 'POST', body: fd });
                    if (resp.ok) {
                        const data = await resp.json();
                        status.textContent = `"${name}" opgeslagen (${data.size_mb}MB)`;
                        status.style.color = '#39ff14';
                    } else throw new Error();
                } catch(e) {
                    // Fallback: localStorage
                    const url = URL.createObjectURL(blob);
                    const recs = JSON.parse(localStorage.getItem('ab_recordings') || '[]');
                    recs.push({ name, url, timestamp: Date.now() });
                    localStorage.setItem('ab_recordings', JSON.stringify(recs));
                    status.textContent = `"${name}" opgeslagen (browser)`;
                    status.style.color = '#f59e0b';
                }

                // Decodeer en trigger onSelect
                try {
                    if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await this._audioCtx.decodeAudioData(await blob.arrayBuffer());
                    this.onSelect(audioBuffer, name);
                } catch(e) {}

                setTimeout(() => { status.textContent = ''; }, 4000);
            };
            recorder.start();
            // Max 60s
            setTimeout(() => { if (this._recording) this.toggleRecording(); }, 60000);
        } catch(e) {
            status.textContent = 'Mic niet beschikbaar';
            status.style.color = '#ef4444';
        }
    }

    async search(presetQuery) {
        const query = presetQuery || this._el('search')?.value || '';
        if (!query) return;
        if (!presetQuery && this._el('search')) this._el('search').value = query;

        const resultsEl = this._el('results');
        if (!resultsEl) return;
        resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Zoeken...</div>';

        const allResults = [];
        const promises = [];
        const isOn = (sid) => this._el(`src-${sid}`)?.checked;

        if (isOn('freesound')) promises.push(this._searchFreesound(query).then(r => allResults.push(...r)).catch(() => {}));
        if (isOn('jamendo')) promises.push(this._searchJamendo(query).then(r => allResults.push(...r)).catch(() => {}));
        if (isOn('archive')) promises.push(this._searchArchive(query).then(r => allResults.push(...r)).catch(() => {}));
        if (isOn('community')) promises.push(this._searchCommunity(query).then(r => allResults.push(...r)).catch(() => {}));
        if (isOn('recordings')) promises.push(this._searchRecordings(query).then(r => allResults.push(...r)).catch(() => {}));

        await Promise.all(promises);
        this._results = allResults;

        if (!allResults.length) {
            resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Geen resultaten</div>';
            return;
        }

        resultsEl.innerHTML = `<div style="font-size:9px;color:var(--text-dim,#8b949e);padding:3px 6px;border-bottom:1px solid var(--border,#30363d)">${allResults.length} resultaten</div>` + allResults.map((r, i) => `
            <div class="ab-item" data-idx="${i}" style="padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;font-size:11px;transition:background 0.15s">
                <div style="display:flex;align-items:center;gap:5px">
                    <span style="cursor:pointer;font-size:16px" title="Afspelen" data-preview="${i}">&#9654;</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text,#e0e0ee)" title="${r.name}">${r.name}</span>
                </div>
                <div style="font-size:8px;color:${r.sourceColor};opacity:.8;margin-left:21px">${r.source}${r.duration ? ' · ' + (typeof r.duration === 'number' ? (r.duration < 60 ? Math.round(r.duration) + 's' : Math.floor(r.duration/60) + ':' + String(Math.round(r.duration%60)).padStart(2,'0')) : r.duration) : ''}</div>
            </div>
        `).join('');

        // Click handlers
        resultsEl.querySelectorAll('.ab-item').forEach(el => {
            el.onmouseover = () => { el.style.background = 'var(--bg-hover,#242d3d)'; };
            el.onmouseout = () => { el.style.background = 'transparent'; };
            el.onclick = (e) => {
                // Preview button
                if (e.target.dataset.preview !== undefined) {
                    this._preview(this._results[+e.target.dataset.preview]);
                    e.stopPropagation();
                    return;
                }
                const r = this._results[+el.dataset.idx];
                if (r) this._loadResult(r);
            };
        });
    }

    // Zoek opnames (lokale API + localStorage)
    async _searchRecordings(query) {
        const results = [];
        // API opnames
        try {
            const resp = await fetch('/api/recordings');
            if (resp.ok) {
                const files = await resp.json();
                files.forEach(f => {
                    if (!query || f.name.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            name: f.name,
                            source: 'Opname',
                            sourceColor: '#ef4444',
                            sourceIcon: 'mic',
                            url: `/api/recordings/${encodeURIComponent(f.name)}`,
                            needsProxy: false
                        });
                    }
                });
            }
        } catch(e) {}
        // localStorage opnames als fallback
        try {
            const recs = JSON.parse(localStorage.getItem('ab_recordings') || '[]');
            recs.forEach(r => {
                if (!query || r.name.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        name: r.name,
                        source: 'Browser',
                        sourceColor: '#f59e0b',
                        sourceIcon: 'mic',
                        url: r.url,
                        needsProxy: false
                    });
                }
            });
        } catch(e) {}
        return results;
    }

    async scanLocal() {
        const resultsEl = this._el('results');
        if (!resultsEl) return;
        resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Scannen... (audio + video bestanden)</div>';

        try {
            // Scan alle schijven (geen path = alles), of cache gebruiken
            let resp;
            try {
                resp = await fetch('/api/scan-cache');
                const cache = await resp.json();
                if (cache.results && cache.results.length > 0) {
                    resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Cache gevonden, herladen... (klik opnieuw voor verse scan)</div>';
                    // Toon cache, start verse scan op achtergrond
                    this._renderScanResults(resultsEl, cache.results);
                    fetch('/api/scan-audio').then(r => r.json()).then(data => {
                        if (data.results) {
                            fetch('/api/scan-cache', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
                        }
                    }).catch(() => {});
                    return;
                }
            } catch(e) {}
            resp = await fetch('/api/scan-audio');
            const data = await resp.json();
            const files = data.results || [];
            if (!files.length) {
                resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Geen bestanden gevonden</div>';
                return;
            }
            // Cache opslaan
            try { fetch('/api/scan-cache', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }); } catch(e) {}
            this._renderScanResults(resultsEl, files);
        } catch(e) {
            resultsEl.innerHTML = '<div style="color:var(--red,#ff4a5a);font-size:11px;padding:8px">Scan niet beschikbaar (alleen op localhost)</div>';
        }
    }

    _renderScanResults(resultsEl, files) {
        this._results = files.map(f => ({
            name: f.name,
            source: `Lokaal · ${f.ext} · ${f.size_mb}MB`,
            sourceColor: '#ffd24a',
            sourceIcon: 'folder',
            url: `/api/local-audio?path=${encodeURIComponent(f.path)}`,
            needsProxy: false,
            duration: f.size_mb > 10 ? 'groot' : ''
        }));
        resultsEl.innerHTML = `<div style="font-size:9px;color:var(--text-dim,#8b949e);padding:3px 6px;border-bottom:1px solid var(--border,#30363d)">${files.length} bestanden gevonden</div>` + this._results.map((r, i) => `
            <div class="ab-item" data-idx="${i}" style="padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;font-size:11px;transition:background 0.15s">
                <div style="display:flex;align-items:center;gap:5px">
                    <span style="cursor:pointer;font-size:16px" title="Afspelen" data-preview="${i}">&#9654;</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text,#e0e0ee)" title="${r.name}">${r.name}</span>
                </div>
                <div style="font-size:8px;color:${r.sourceColor};opacity:.8;margin-left:21px">${r.source}</div>
            </div>
        `).join('');
        resultsEl.querySelectorAll('.ab-item').forEach(el => {
            el.onmouseover = () => { el.style.background = 'var(--bg-hover,#242d3d)'; };
            el.onmouseout = () => { el.style.background = 'transparent'; };
            el.onclick = (e) => {
                if (e.target.dataset.preview !== undefined) {
                    this._preview(this._results[+e.target.dataset.preview]);
                    e.stopPropagation();
                    return;
                }
                const r = this._results[+el.dataset.idx];
                if (r) this._loadResult(r);
            };
        });
    }

    // ---- Audio preview (play in browser without loading to pad) ----
    async _preview(result) {
        if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this._previewSource) { try { this._previewSource.stop(); } catch(e) {} }

        try {
            let url = result.url;
            let resp;
            if (result.needsProxy) {
                try {
                    resp = await fetch(`/api/proxy/audio?url=${encodeURIComponent(url)}`);
                    if (!resp.ok) throw new Error();
                } catch(e) {
                    resp = await fetch(url);
                }
            } else {
                resp = await fetch(url);
            }
            const buf = await resp.arrayBuffer();
            const audioBuffer = await this._audioCtx.decodeAudioData(buf);
            const src = this._audioCtx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(this._audioCtx.destination);
            src.start();
            this._previewSource = src;
            // Auto-stop after 5s
            setTimeout(() => { try { src.stop(); } catch(e) {} }, 5000);
        } catch(e) {}
    }

    // ---- Load result and pass to callback ----
    async _loadResult(result) {
        try {
            let url = result.url;
            let resp;
            if (result.needsProxy) {
                try {
                    resp = await fetch(`/api/proxy/audio?url=${encodeURIComponent(url)}`);
                    if (!resp.ok) throw new Error();
                } catch(e) {
                    resp = await fetch(url);
                }
            } else {
                resp = await fetch(url);
            }
            if (!resp.ok) return;
            const buf = await resp.arrayBuffer();

            // If onSelectUrl is set and caller wants URL (e.g. DJ decks)
            if (this.onSelectUrl) {
                this.onSelectUrl(url, result.name);
            }

            // Decode and pass AudioBuffer
            if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await this._audioCtx.decodeAudioData(buf);
            this.onSelect(audioBuffer, result.name);
        } catch(e) {}
    }

    // ---- API Search Functions ----
    async _searchFreesound(query) {
        const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&token=${this.freesoundKey}&page_size=15&fields=id,name,duration,previews,tags&filter=duration:[0.1 TO 30]`;
        const resp = await fetch(url);
        const data = await resp.json();
        return (data.results || []).map(s => ({
            name: s.name,
            source: 'Freesound',
            sourceColor: 'var(--accent,#4a9eff)',
            sourceIcon: 'graphic_eq',
            url: s.previews?.['preview-hq-mp3'] || s.previews?.['preview-lq-mp3'],
            needsProxy: true,
            duration: s.duration
        }));
    }

    async _searchJamendo(query) {
        const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${this.jamendoId}&format=json&limit=10&search=${encodeURIComponent(query)}&include=musicinfo`;
        const resp = await fetch(url);
        const data = await resp.json();
        return (data.results || []).map(t => ({
            name: `${t.artist_name} - ${t.name}`,
            source: 'Jamendo',
            sourceColor: 'var(--orange,#ff8a4a)',
            sourceIcon: 'music_note',
            url: t.audio || t.audiodownload,
            needsProxy: false,
            duration: t.duration
        }));
    }

    async _searchArchive(query) {
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}+mediatype:audio&fl[]=identifier&fl[]=title&fl[]=creator&output=json&rows=10&sort[]=downloads+desc`;
        const resp = await fetch(url);
        const data = await resp.json();
        return (data.response?.docs || []).map(item => ({
            name: item.title || item.identifier,
            source: 'Archive',
            sourceColor: 'var(--green,#39ff14)',
            sourceIcon: 'archive',
            url: `https://archive.org/download/${item.identifier}/${item.identifier}_vbr.mp3`,
            needsProxy: false
        }));
    }

    async _searchCommunity(query) {
        const sb = this._getSupabase();
        if (!sb) return [];
        try {
            let q = sb.from('community_samples').select('*').limit(10);
            if (query) q = q.or(`name.ilike.%${query}%,tags.cs.{${query}}`);
            const { data } = await q;
            return (data || []).map(s => ({
                name: s.name || 'Community Sample',
                source: 'Community',
                sourceColor: 'var(--purple,#a855f7)',
                sourceIcon: 'people',
                url: `${this.supabaseUrl}/storage/v1/object/public/samples/${s.file_path}`,
                needsProxy: false
            }));
        } catch(e) { return []; }
    }

    _getSupabase() {
        if (this._supabase) return this._supabase;
        if (typeof supabase !== 'undefined' && this.supabaseUrl && this.supabaseKey) {
            this._supabase = supabase.createClient(this.supabaseUrl, this.supabaseKey);
        }
        return this._supabase;
    }
}

// Export voor gebruik als module of via script tag
if (typeof module !== 'undefined') module.exports = AudioBrowser;
