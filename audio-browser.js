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

    // ---- IndexedDB: permanent lokale opslag (werkt overal, honderden MB's) ----
    static _dbPromise = null;
    static _openDB() {
        if (AudioBrowser._dbPromise) return AudioBrowser._dbPromise;
        AudioBrowser._dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('DAW_Recordings', 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('recordings')) {
                    db.createObjectStore('recordings', { keyPath: 'name' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return AudioBrowser._dbPromise;
    }

    static async saveToIndexedDB(name, blob) {
        const db = await AudioBrowser._openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('recordings', 'readwrite');
            tx.objectStore('recordings').put({
                name,
                blob,
                size: blob.size,
                timestamp: Date.now(),
                type: blob.type
            });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    static async getAllFromIndexedDB() {
        const db = await AudioBrowser._openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('recordings', 'readonly');
            const req = tx.objectStore('recordings').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    static async getFromIndexedDB(name) {
        const db = await AudioBrowser._openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('recordings', 'readonly');
            const req = tx.objectStore('recordings').get(name);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

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
        c.style.cssText = 'background:var(--bg-panel,#161b22);border-radius:8px;padding:6px;font-family:inherit;font-size:11px;';

        // Zoekbalk + Opnemen + Scan PC
        const top = document.createElement('div');
        top.style.cssText = 'display:flex;gap:3px;margin-bottom:4px';
        top.innerHTML = `
            <input type="text" id="${id}-search" placeholder="Zoek geluiden..." style="flex:1;background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d);border-radius:4px;color:var(--text,#e0e0ee);padding:4px 8px;font-size:11px;outline:none">
            <button id="${id}-search-btn" style="padding:4px 10px;background:#4a9eff;border:none;border-radius:4px;color:#fff;font-size:10px;font-weight:700;cursor:pointer">Zoek</button>
            <button id="${id}-rec-btn" style="padding:4px 8px;background:#ef4444;border:none;border-radius:4px;color:#fff;font-size:10px;font-weight:700;cursor:pointer">&#127908;</button>
            ${this.showLocalScan ? `<button id="${id}-scan-btn" style="padding:4px 8px;background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d);border-radius:4px;color:var(--text,#e0e0ee);font-size:9px;cursor:pointer">PC</button>` : ''}
        `;
        c.appendChild(top);
        const recStatus = document.createElement('div');
        recStatus.id = `${id}-rec-status`;
        recStatus.style.cssText = 'font-size:9px;color:var(--text-dim,#8b949e);padding:0 2px;display:none';
        c.appendChild(recStatus);

        // API vakken (inklapbaar, elk met eigen categorieën)
        const apiSections = [
            { sid: 'freesound', label: 'Freesound', color: '#4a9eff', icon: '🔊',
              cats: [
                { q: 'kick drum', l: 'Kick' }, { q: 'snare drum', l: 'Snare' }, { q: 'hi-hat cymbal', l: 'Hi-Hat' },
                { q: 'clap handclap', l: 'Clap' }, { q: 'percussion bongo', l: 'Perc' },
                { q: 'bass guitar', l: 'Bass' }, { q: 'acoustic guitar', l: 'Gitaar' }, { q: 'piano chord', l: 'Piano' },
                { q: 'trumpet brass', l: 'Blazers' }, { q: 'strings orchestra', l: 'Strings' },
                { q: 'synth pad', l: 'Synth' }, { q: 'vocal chop', l: 'Vocals' },
                { q: 'sound effect', l: 'FX' }, { q: 'ambient nature', l: 'Natuur' },
              ]},
            { sid: 'jamendo', label: 'Jamendo', color: '#ff8a4a', icon: '🎵',
              cats: [
                { q: 'jazz', l: 'Jazz' }, { q: 'blues', l: 'Blues' }, { q: 'reggae', l: 'Reggae' },
                { q: 'funk soul', l: 'Funk' }, { q: 'hip hop', l: 'HipHop' }, { q: 'electronic', l: 'Electronic' },
                { q: 'rock', l: 'Rock' }, { q: 'classical', l: 'Klassiek' }, { q: 'ambient', l: 'Ambient' },
                { q: 'pop', l: 'Pop' }, { q: 'african', l: 'Afrikaans' }, { q: 'latin', l: 'Latin' },
              ]},
            { sid: 'archive', label: 'Internet Archive', color: '#39ff14', icon: '📚',
              cats: [
                { q: 'jazz music', l: 'Jazz' }, { q: 'blues music', l: 'Blues' }, { q: 'classical music', l: 'Klassiek' },
                { q: 'folk music', l: 'Folk' }, { q: 'world music', l: 'Wereld' }, { q: 'spoken word', l: 'Spoken' },
              ]},
            { sid: 'bbc', label: 'BBC Sound Effects', color: '#ff6b6b', icon: '📻',
              cats: [
                { q: 'rain water', l: 'Regen' }, { q: 'wind storm', l: 'Wind' }, { q: 'bird', l: 'Vogels' },
                { q: 'traffic car', l: 'Verkeer' }, { q: 'crowd people', l: 'Menigte' }, { q: 'door knock', l: 'Deur' },
                { q: 'explosion', l: 'Explosie' }, { q: 'bell clock', l: 'Bel' }, { q: 'footsteps', l: 'Stappen' },
                { q: 'ocean sea wave', l: 'Zee' }, { q: 'fire', l: 'Vuur' }, { q: 'telephone', l: 'Telefoon' },
              ]},
            { sid: 'ccmixter', label: 'ccMixter', color: '#00cc88', icon: '🎼',
              cats: [
                { q: 'drums', l: 'Drums' }, { q: 'bass', l: 'Bass' }, { q: 'guitar', l: 'Gitaar' },
                { q: 'piano', l: 'Piano' }, { q: 'vocals', l: 'Vocals' }, { q: 'ambient', l: 'Ambient' },
                { q: 'hiphop', l: 'HipHop' }, { q: 'jazz', l: 'Jazz' }, { q: 'electronic', l: 'Electronic' },
              ]},
            { sid: 'deezer', label: 'Deezer', color: '#a238ff', icon: '🎧',
              cats: [
                { q: 'jazz', l: 'Jazz' }, { q: 'reggae', l: 'Reggae' }, { q: 'hip hop', l: 'HipHop' },
                { q: 'afrobeat', l: 'Afrobeat' }, { q: 'classical', l: 'Klassiek' }, { q: 'blues', l: 'Blues' },
                { q: 'funk soul', l: 'Funk' }, { q: 'electronic', l: 'Electronic' }, { q: 'arabic', l: 'Arabisch' },
                { q: 'gospel', l: 'Gospel' }, { q: 'latin salsa', l: 'Latin' }, { q: 'african music', l: 'Afrikaans' },
              ]},
            { sid: 'community', label: 'Community', color: '#a855f7', icon: '👥',
              cats: [
                { q: 'drums', l: 'Drums' }, { q: 'bass', l: 'Bass' }, { q: 'melody', l: 'Melodie' },
                { q: 'loop', l: 'Loops' }, { q: 'vocals', l: 'Vocals' },
              ]},
            { sid: 'recordings', label: 'Opnames', color: '#ef4444', icon: '🎤',
              cats: [] },
        ];

        const sections = document.createElement('div');
        sections.style.cssText = 'margin-bottom:4px';
        apiSections.forEach(api => {
            const sec = document.createElement('div');
            sec.style.cssText = `border:1px solid var(--border,#30363d);border-left:3px solid ${api.color};border-radius:4px;margin-bottom:3px;overflow:hidden`;
            // Header (klikbaar om in/uit te klappen)
            const hdr = document.createElement('div');
            hdr.style.cssText = `display:flex;align-items:center;gap:4px;padding:4px 8px;cursor:pointer;background:var(--bg-dark,#0d1117);font-size:10px;font-weight:700;color:${api.color}`;
            hdr.innerHTML = `<span id="${id}-arrow-${api.sid}" style="font-size:8px;transition:transform .2s">▶</span> ${api.icon} ${api.label}`;
            const body = document.createElement('div');
            body.id = `${id}-body-${api.sid}`;
            body.style.cssText = 'display:none;padding:4px 6px';
            // Checkbox aan/uit
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            cb.id = `${id}-src-${api.sid}`;
            cb.style.cssText = `width:12px;height:12px;accent-color:${api.color};margin-left:auto`;
            cb.onclick = (e) => e.stopPropagation();
            hdr.appendChild(cb);

            hdr.onclick = () => {
                const open = body.style.display !== 'none';
                body.style.display = open ? 'none' : 'block';
                const arrow = this._el(`arrow-${api.sid}`);
                if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
            };
            sec.appendChild(hdr);

            // Categorie knoppen
            if (api.cats.length > 0) {
                const catDiv = document.createElement('div');
                catDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;margin-bottom:4px';
                api.cats.forEach(cat => {
                    const btn = document.createElement('button');
                    btn.textContent = cat.l;
                    btn.style.cssText = `font-size:8px;padding:1px 6px;border-radius:3px;border:1px solid ${api.color}33;background:transparent;color:var(--text,#e0e0ee);cursor:pointer`;
                    btn.onmouseover = () => { btn.style.background = api.color + '22'; };
                    btn.onmouseout = () => { btn.style.background = 'transparent'; };
                    btn.onclick = () => this._searchSingleAPI(api.sid, cat.q);
                    catDiv.appendChild(btn);
                });
                body.appendChild(catDiv);
            }
            // Opnames: toon direct lijst
            if (api.sid === 'recordings') {
                const recList = document.createElement('div');
                recList.id = `${id}-reclist`;
                recList.style.cssText = 'font-size:10px;color:var(--text-dim,#8b949e)';
                recList.textContent = 'Laden...';
                body.appendChild(recList);
                // Laad opnames bij renderen
                setTimeout(() => this._loadRecordingsList(), 500);
            }
            // Resultaten per API
            const apiResults = document.createElement('div');
            apiResults.id = `${id}-res-${api.sid}`;
            body.appendChild(apiResults);

            sec.appendChild(body);
            sections.appendChild(sec);
        });
        c.appendChild(sections);

        // Globale resultaten (voor zoekbalk)
        const results = document.createElement('div');
        results.id = `${id}-results`;
        results.style.cssText = 'max-height:350px;overflow-y:auto';
        c.appendChild(results);

        // Event bindings
        this._el('search').onkeydown = (e) => { if (e.key === 'Enter') this.search(); };
        this._el('search-btn').onclick = () => this.search();
        this._el('rec-btn').onclick = () => this.toggleRecording();
        if (this._el('scan-btn')) this._el('scan-btn').onclick = () => this.scanLocal();
    }

    // Zoek in 1 specifieke API en toon resultaten in dat vak
    async _searchSingleAPI(sid, query) {
        const resEl = this._el(`res-${sid}`);
        if (resEl) resEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:10px;padding:4px">Zoeken...</div>';
        let results = [];
        try {
            if (sid === 'freesound') results = await this._searchFreesound(query);
            else if (sid === 'jamendo') results = await this._searchJamendo(query);
            else if (sid === 'archive') results = await this._searchArchive(query);
            else if (sid === 'bbc') results = await this._searchBBC(query);
            else if (sid === 'ccmixter') results = await this._searchCCMixter(query);
            else if (sid === 'deezer') results = await this._searchDeezer(query);
            else if (sid === 'community') results = await this._searchCommunity(query);
        } catch(e) {}
        this._results = results;
        if (resEl) resEl.innerHTML = this._renderResultsHTML(results);
        this._bindResultClicks(resEl);
    }

    // Laad opnames lijst in het Opnames vak
    async _loadRecordingsList() {
        const el = this._el('reclist');
        if (!el) return;
        const recs = await this._searchRecordings('');
        if (!recs.length) {
            el.innerHTML = '<div style="padding:4px;color:var(--text-dim,#8b949e);font-size:9px">Nog geen opnames</div>';
            return;
        }
        this._results = recs;
        el.innerHTML = recs.map((r, i) => `
            <div class="ab-item" data-idx="${i}" style="padding:3px 4px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .15s">
                <div style="display:flex;align-items:center;gap:4px">
                    <span style="cursor:pointer;font-size:14px;color:#ef4444" data-preview="${i}">&#9654;</span>
                    <span style="flex:1;color:var(--text,#e0e0ee);font-size:10px">${r.name}</span>
                    <span style="cursor:pointer;font-size:12px;color:var(--text-dim,#8b949e)" data-download="${i}" title="Download">&#11015;</span>
                </div>
            </div>
        `).join('');
        this._bindResultClicks(el);
    }

    _renderResultsHTML(results) {
        if (!results.length) return '<div style="color:var(--text-dim,#8b949e);font-size:10px;padding:4px">Geen resultaten</div>';
        return results.map((r, i) => `
            <div class="ab-item" data-idx="${i}" style="padding:3px 4px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;font-size:10px;transition:background .15s">
                <div style="display:flex;align-items:center;gap:4px">
                    <span style="cursor:pointer;font-size:14px" data-preview="${i}">&#9654;</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text,#e0e0ee)" title="${r.name}">${r.name}</span>
                </div>
                <div style="font-size:7px;color:${r.sourceColor};opacity:.8;margin-left:18px">${r.source}${r.duration ? ' · ' + (typeof r.duration === 'number' ? (r.duration < 60 ? Math.round(r.duration) + 's' : Math.floor(r.duration/60) + ':' + String(Math.round(r.duration%60)).padStart(2,'0')) : r.duration) : ''}</div>
            </div>
        `).join('');
    }

    _bindResultClicks(container) {
        if (!container) return;
        container.querySelectorAll('.ab-item').forEach(el => {
            el.onmouseover = () => { el.style.background = 'var(--bg-hover,#242d3d)'; };
            el.onmouseout = () => { el.style.background = 'transparent'; };
            el.onclick = async (e) => {
                if (e.target.dataset.preview !== undefined) {
                    this._preview(this._results[+e.target.dataset.preview]);
                    e.stopPropagation();
                    return;
                }
                if (e.target.dataset.download !== undefined) {
                    const r = this._results[+e.target.dataset.download];
                    if (r) {
                        try {
                            let blob;
                            if (r._idbName) {
                                const rec = await AudioBrowser.getFromIndexedDB(r._idbName);
                                blob = rec?.blob;
                            } else if (r.url) {
                                blob = await (await fetch(r.url)).blob();
                            }
                            if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = r.name; a.click(); }
                        } catch(e) {}
                    }
                    e.stopPropagation();
                    return;
                }
                const r = this._results[+el.dataset.idx];
                if (r) this._loadResult(r);
            };
        });
    }

    // ---- Mijn Opnames tonen ----
    async showMyRecordings() {
        const resultsEl = this._el('results');
        if (!resultsEl) return;
        resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Opnames laden...</div>';
        const recs = await this._searchRecordings('');
        if (!recs.length) {
            resultsEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-dim,#8b949e);font-size:11px">Nog geen opnames. Klik "Opnemen" om je eerste opname te maken.</div>';
            return;
        }
        this._results = recs;
        resultsEl.innerHTML = `<div style="font-size:9px;color:#ef4444;padding:3px 6px;border-bottom:1px solid var(--border,#30363d);font-weight:700">${recs.length} opname${recs.length !== 1 ? 's' : ''}</div>` + recs.map((r, i) => `
            <div class="ab-item" data-idx="${i}" style="padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;font-size:11px;transition:background 0.15s">
                <div style="display:flex;align-items:center;gap:5px">
                    <span style="cursor:pointer;font-size:16px;color:#ef4444" title="Afspelen" data-preview="${i}">&#9654;</span>
                    <span style="flex:1;color:var(--text,#e0e0ee)">${r.name}</span>
                    <span style="cursor:pointer;font-size:13px;color:var(--text-dim,#8b949e)" title="Download" data-download="${i}">&#11015;</span>
                </div>
                <div style="font-size:8px;color:#ef4444;opacity:.8;margin-left:21px">${r.source}</div>
            </div>
        `).join('');
        resultsEl.querySelectorAll('.ab-item').forEach(el => {
            el.onmouseover = () => { el.style.background = 'var(--bg-hover,#242d3d)'; };
            el.onmouseout = () => { el.style.background = 'transparent'; };
            el.onclick = async (e) => {
                if (e.target.dataset.preview !== undefined) {
                    this._preview(this._results[+e.target.dataset.preview]);
                    e.stopPropagation();
                    return;
                }
                if (e.target.dataset.download !== undefined) {
                    const r = this._results[+e.target.dataset.download];
                    if (r) {
                        try {
                            let blob;
                            if (r._idbName) {
                                const rec = await AudioBrowser.getFromIndexedDB(r._idbName);
                                blob = rec?.blob;
                            } else if (r.url) {
                                const resp = await fetch(r.url);
                                blob = await resp.blob();
                            }
                            if (blob) {
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = r.name;
                                a.click();
                                URL.revokeObjectURL(a.href);
                            }
                        } catch(e) {}
                    }
                    e.stopPropagation();
                    return;
                }
                const r = this._results[+el.dataset.idx];
                if (r) this._loadResult(r);
            };
        });
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

                // Opslaan: 1) API server 2) IndexedDB (permanent, groot) 3) Download
                let saved = false;
                try {
                    const fd = new FormData();
                    fd.append('audio', blob, name + '.webm');
                    fd.append('name', name);
                    const resp = await fetch('/api/recordings', { method: 'POST', body: fd });
                    if (resp.ok) {
                        const data = await resp.json();
                        status.textContent = `"${name}" opgeslagen op server`;
                        status.style.color = '#39ff14';
                        saved = true;
                    }
                } catch(e) {}

                // Altijd ook opslaan in IndexedDB (werkt op GitHub Pages, honderden MB's)
                try {
                    await AudioBrowser.saveToIndexedDB(name + '.webm', blob);
                    if (!saved) {
                        status.textContent = `"${name}" opgeslagen lokaal`;
                        status.style.color = '#39ff14';
                    }
                } catch(e) {
                    if (!saved) {
                        status.textContent = `"${name}" niet opgeslagen`;
                        status.style.color = '#ef4444';
                    }
                }

                // Download ook automatisch naar Downloads map
                try {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = name + '.webm';
                    a.click();
                    URL.revokeObjectURL(a.href);
                } catch(e) {}

                // Decodeer en trigger onSelect
                try {
                    if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await this._audioCtx.decodeAudioData(await blob.arrayBuffer());
                    this.onSelect(audioBuffer, name);
                } catch(e) {}

                // Toon opnames lijst na 2 seconden
                setTimeout(() => {
                    status.style.display = 'none';
                    // Open Opnames vak en herlaad lijst
                    const body = this._el('body-recordings');
                    if (body) body.style.display = 'block';
                    const arrow = this._el('arrow-recordings');
                    if (arrow) arrow.style.transform = 'rotate(90deg)';
                    this._loadRecordingsList();
                }, 2000);
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
        if (isOn('bbc')) promises.push(this._searchBBC(query).then(r => allResults.push(...r)).catch(() => {}));
        if (isOn('ccmixter')) promises.push(this._searchCCMixter(query).then(r => allResults.push(...r)).catch(() => {}));
        if (isOn('deezer')) promises.push(this._searchDeezer(query).then(r => allResults.push(...r)).catch(() => {}));
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

    // Zoek opnames (API server + IndexedDB)
    async _searchRecordings(query) {
        const results = [];
        const seen = new Set();
        // 1) API server opnames (als beschikbaar)
        try {
            const resp = await fetch('/api/recordings');
            if (resp.ok) {
                const files = await resp.json();
                files.forEach(f => {
                    if (!query || f.name.toLowerCase().includes(query.toLowerCase())) {
                        seen.add(f.name);
                        results.push({
                            name: f.name,
                            source: 'Server',
                            sourceColor: '#39ff14',
                            sourceIcon: 'mic',
                            url: `/api/recordings/${encodeURIComponent(f.name)}`,
                            needsProxy: false
                        });
                    }
                });
            }
        } catch(e) {}
        // 2) IndexedDB opnames (permanent, werkt op GitHub Pages)
        try {
            const idbRecs = await AudioBrowser.getAllFromIndexedDB();
            idbRecs.forEach(r => {
                if (seen.has(r.name)) return; // skip dubbelen
                if (!query || r.name.toLowerCase().includes(query.toLowerCase())) {
                    const sizeMB = r.size ? (r.size / 1024 / 1024).toFixed(1) + 'MB' : '';
                    results.push({
                        name: r.name,
                        source: `Lokaal ${sizeMB}`,
                        sourceColor: '#ef4444',
                        sourceIcon: 'mic',
                        url: null, // laden via IndexedDB blob
                        _idbName: r.name,
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
    // Haal ArrayBuffer op uit result (URL, proxy, of IndexedDB)
    async _fetchResultBuffer(result) {
        // IndexedDB opname (geen URL)
        if (result._idbName) {
            const rec = await AudioBrowser.getFromIndexedDB(result._idbName);
            if (rec && rec.blob) return await rec.blob.arrayBuffer();
            throw new Error('Niet gevonden in IndexedDB');
        }
        // URL fetch (met proxy fallback)
        let resp;
        if (result.needsProxy) {
            try {
                resp = await fetch(`/api/proxy/audio?url=${encodeURIComponent(result.url)}`);
                if (!resp.ok) throw new Error();
            } catch(e) {
                resp = await fetch(result.url);
            }
        } else {
            resp = await fetch(result.url);
        }
        if (!resp.ok) throw new Error('Fetch failed');
        return await resp.arrayBuffer();
    }

    async _preview(result) {
        if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this._previewSource) { try { this._previewSource.stop(); } catch(e) {} }
        try {
            const buf = await this._fetchResultBuffer(result);
            const audioBuffer = await this._audioCtx.decodeAudioData(buf);
            const src = this._audioCtx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(this._audioCtx.destination);
            src.start();
            this._previewSource = src;
            setTimeout(() => { try { src.stop(); } catch(e) {} }, 5000);
        } catch(e) { console.warn('Preview error:', e); }
    }

    async _loadResult(result) {
        try {
            const buf = await this._fetchResultBuffer(result);
            if (this.onSelectUrl && result.url) this.onSelectUrl(result.url, result.name);
            if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await this._audioCtx.decodeAudioData(buf);
            this.onSelect(audioBuffer, result.name);
        } catch(e) { console.warn('Load error:', e); }
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

    async _searchBBC(query) {
        // Geluidseffecten zoeken op Archive.org (BBC + andere bronnen)
        const url = `https://archive.org/advancedsearch.php?q=title:"sound+effects"+${encodeURIComponent(query)}+mediatype:audio&fl[]=identifier&fl[]=title&output=json&rows=12&sort[]=downloads+desc`;
        const resp = await fetch(url);
        const data = await resp.json();
        return (data.response?.docs || []).map(item => ({
            name: (item.title || item.identifier).substring(0, 60),
            source: 'BBC/Archive',
            sourceColor: '#ff6b6b',
            url: `https://archive.org/download/${item.identifier}/${item.identifier}_vbr.mp3`,
            needsProxy: false
        }));
    }

    async _searchDeezer(query) {
        // Deezer: 30s previews, geen auth. CORS proxy nodig voor search API
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=12`)}`,
            `https://corsproxy.io/?${encodeURIComponent(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=12`)}`,
        ];
        let data = null;
        for (const p of proxies) {
            try { const r = await fetch(p); if (r.ok) { data = await r.json(); break; } } catch(e) {}
        }
        if (!data) try { const r = await fetch(`/api/proxy/audio?url=${encodeURIComponent(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=12`)}`); if (r.ok) data = await r.json(); } catch(e) {}
        if (!data) return [];
        return (data.data || []).map(t => ({
            name: `${t.artist?.name || ''} - ${t.title || ''}`.trim(),
            source: 'Deezer · 30s',
            sourceColor: '#a238ff',
            url: t.preview,
            needsProxy: false,
            duration: 30
        }));
    }

    async _searchCCMixter(query) {
        // ccMixter: CC-licensed muziek, geen auth nodig
        const url = `https://ccmixter.org/api/query?datasource=uploads&f=json&limit=10&tags=${encodeURIComponent(query)}`;
        let data = null;
        try { const r = await fetch(url); if (r.ok) data = await r.json(); } catch(e) {}
        if (!data) try { const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`); if (r.ok) data = await r.json(); } catch(e) {}
        if (!data) return [];
        return (data || []).map(t => ({
            name: `${t.user_name} - ${t.upload_name}`,
            source: 'ccMixter',
            sourceColor: '#00cc88',
            url: t.files?.[0]?.download_url || '',
            needsProxy: false,
        })).filter(r => r.url);
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
