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

        if (this.container) this.render();
    }

    render() {
        const c = this.container;
        c.innerHTML = '';
        c.style.cssText = 'background:var(--bg-panel,#161b22);border:1px solid var(--border,#30363d);border-radius:8px;padding:10px;font-family:inherit;';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'font-size:11px;font-weight:700;color:var(--accent,#4a9eff);margin-bottom:6px;display:flex;align-items:center;gap:6px';
        header.innerHTML = '<span style="font-size:14px" class="material-icons">library_music</span> Sample Browser';
        c.appendChild(header);

        // Source toggles
        const toggles = document.createElement('div');
        toggles.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap';
        const sources = [
            { id: 'freesound', label: 'Freesound', color: 'var(--accent,#4a9eff)' },
            { id: 'jamendo', label: 'Jamendo', color: 'var(--orange,#ff8a4a)' },
            { id: 'archive', label: 'Archive', color: 'var(--green,#39ff14)' },
            { id: 'community', label: 'Community', color: 'var(--purple,#a855f7)' },
        ];
        sources.forEach(src => {
            const label = document.createElement('label');
            label.style.cssText = `font-size:10px;display:flex;align-items:center;gap:3px;cursor:pointer;padding:3px 8px;border-radius:4px;background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d)`;
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            cb.id = `ab-src-${src.id}`;
            cb.style.accentColor = src.color;
            label.appendChild(cb);
            label.appendChild(document.createTextNode(` ${src.label}`));
            toggles.appendChild(label);
        });
        c.appendChild(toggles);

        // Category buttons
        const cats = document.createElement('div');
        cats.style.cssText = 'display:flex;gap:3px;margin-bottom:6px;flex-wrap:wrap';
        const categories = this.compact
            ? ['kick','snare','bass','guitar','piano','synth','vocals','fx']
            : ['kick drum','snare drum','hi-hat','clap','bass guitar','guitar riff','piano chord','trumpet','saxophone','strings orchestra','synth pad','vocal chop','bird animal','dog cat animal','rain thunder nature','explosion boom','reggae','bongo conga'];
        const catLabels = this.compact
            ? ['Kick','Snare','Bass','Gitaar','Piano','Synth','Vocals','FX']
            : ['Kick','Snare','Hi-Hat','Clap','Bass','Gitaar','Piano','Trompet','Sax','Strings','Synth','Vocals','Vogels','Dieren','Natuur','FX','Reggae','Conga'];
        categories.forEach((q, i) => {
            const btn = document.createElement('button');
            btn.textContent = catLabels[i];
            btn.style.cssText = 'font-size:9px;padding:2px 8px;border-radius:4px;border:1px solid var(--border,#30363d);background:var(--bg-panel,#161b22);color:var(--text,#e0e0ee);cursor:pointer;transition:all 0.15s';
            btn.onmouseover = () => { btn.style.background = 'var(--bg-hover,#242d3d)'; };
            btn.onmouseout = () => { btn.style.background = 'var(--bg-panel,#161b22)'; };
            btn.onclick = () => this.search(q);
            cats.appendChild(btn);
        });
        c.appendChild(cats);

        // Search bar
        const searchBar = document.createElement('div');
        searchBar.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Zoek in alle bronnen...';
        input.id = 'ab-search-input';
        input.style.cssText = 'flex:1;background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d);border-radius:6px;color:var(--text,#e0e0ee);padding:6px 10px;font-size:12px;outline:none';
        input.onkeydown = (e) => { if (e.key === 'Enter') this.search(); };
        input.onfocus = () => { input.style.borderColor = 'var(--accent,#4a9eff)'; };
        input.onblur = () => { input.style.borderColor = 'var(--border,#30363d)'; };
        searchBar.appendChild(input);

        const searchBtn = document.createElement('button');
        searchBtn.textContent = 'Zoek';
        searchBtn.style.cssText = 'padding:6px 14px;background:var(--accent,#4a9eff);border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer';
        searchBtn.onclick = () => this.search();
        searchBar.appendChild(searchBtn);

        if (this.showLocalScan) {
            const scanBtn = document.createElement('button');
            scanBtn.textContent = 'Scan PC';
            scanBtn.style.cssText = 'padding:6px 10px;background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d);border-radius:6px;color:var(--text,#e0e0ee);font-size:11px;cursor:pointer';
            scanBtn.onclick = () => this.scanLocal();
            searchBar.appendChild(scanBtn);
        }

        c.appendChild(searchBar);

        // Results
        const results = document.createElement('div');
        results.id = 'ab-results';
        results.style.cssText = 'max-height:300px;overflow-y:auto';
        c.appendChild(results);
    }

    async search(presetQuery) {
        const query = presetQuery || document.getElementById('ab-search-input')?.value || '';
        if (!query) return;
        if (!presetQuery) {
            const input = document.getElementById('ab-search-input');
            if (input) input.value = query;
        }

        const resultsEl = document.getElementById('ab-results');
        if (!resultsEl) return;
        resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Zoeken...</div>';

        const allResults = [];
        const promises = [];
        const isOn = (id) => document.getElementById(`ab-src-${id}`)?.checked;

        if (isOn('freesound')) promises.push(this._searchFreesound(query).then(r => allResults.push(...r)).catch(() => {}));
        if (isOn('jamendo')) promises.push(this._searchJamendo(query).then(r => allResults.push(...r)).catch(() => {}));
        if (isOn('archive')) promises.push(this._searchArchive(query).then(r => allResults.push(...r)).catch(() => {}));
        if (isOn('community')) promises.push(this._searchCommunity(query).then(r => allResults.push(...r)).catch(() => {}));

        await Promise.all(promises);
        this._results = allResults;

        if (!allResults.length) {
            resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Geen resultaten</div>';
            return;
        }

        resultsEl.innerHTML = allResults.map((r, i) => `
            <div class="ab-item" data-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:6px;border-radius:6px;cursor:pointer;font-size:11px;transition:background 0.15s">
                <span class="material-icons" style="font-size:16px;color:${r.sourceColor}">${r.sourceIcon}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.name}">${r.name}</span>
                <span class="material-icons" style="font-size:14px;color:var(--text-dim,#8b949e);cursor:pointer" title="Preview" data-preview="${i}">play_circle</span>
                <span style="color:var(--text-dim,#8b949e);font-size:8px;min-width:50px;text-align:right">${r.source}</span>
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

    async scanLocal() {
        const resultsEl = document.getElementById('ab-results');
        if (!resultsEl) return;
        resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Scannen...</div>';

        try {
            const resp = await fetch('/api/scan-audio?path=audio');
            const data = await resp.json();
            const files = data.results || [];
            if (!files.length) {
                resultsEl.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:8px">Geen bestanden gevonden</div>';
                return;
            }
            this._results = files.map(f => ({
                name: f.name,
                source: 'Lokaal',
                sourceColor: 'var(--yellow,#ffd24a)',
                sourceIcon: 'folder',
                url: `/api/local-audio?path=${encodeURIComponent(f.path)}`,
                needsProxy: false
            }));
            resultsEl.innerHTML = this._results.map((r, i) => `
                <div class="ab-item" data-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:6px;border-radius:6px;cursor:pointer;font-size:11px;transition:background 0.15s">
                    <span class="material-icons" style="font-size:16px;color:${r.sourceColor}">${r.sourceIcon}</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name}</span>
                    <span style="color:var(--text-dim,#8b949e);font-size:8px">Lokaal</span>
                </div>
            `).join('');
            resultsEl.querySelectorAll('.ab-item').forEach(el => {
                el.onmouseover = () => { el.style.background = 'var(--bg-hover,#242d3d)'; };
                el.onmouseout = () => { el.style.background = 'transparent'; };
                el.onclick = () => {
                    const r = this._results[+el.dataset.idx];
                    if (r) this._loadResult(r);
                };
            });
        } catch(e) {
            resultsEl.innerHTML = '<div style="color:var(--red,#ff4a5a);font-size:11px;padding:8px">Scan niet beschikbaar (alleen op localhost)</div>';
        }
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
