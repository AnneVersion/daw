// ============================================================
// LIBRARY PANEL - Herbruikbaar sound library panel voor alle pagina's
//
// Toont sounds uit:
// 1. Lokale PostgreSQL library (/api/sounds)
// 2. Eigen opnames (localStorage 'daw-recordings')
// 3. Scan PC (/api/scan-audio)
// 4. Audio Browser module (Freesound/Jamendo/Archive/Community)
//
// Gebruik:
//   const lib = new LibraryPanel({
//     container: document.getElementById('my-container'),
//     onSelect: (url, name, metadata) => { /* gebruik het geluid */ },
//     onSelectBuffer: (audioBuffer, name) => { /* voor sampler pads */ },
//     showFilters: true,     // toon BPM/key/format filters
//     showCategories: true,  // toon categorie chips
//     showRecordings: true,  // toon eigen opnames tab
//     compact: false,        // compact mode
//   });
// ============================================================

class LibraryPanel {
    constructor(options = {}) {
        this.container = options.container;
        this.onSelect = options.onSelect || (() => {});
        this.onSelectBuffer = options.onSelectBuffer || null;
        this.showFilters = options.showFilters !== false;
        this.showCategories = options.showCategories !== false;
        this.showRecordings = options.showRecordings !== false;
        this.compact = options.compact || false;
        this._audioCtx = null;
        this._previewSource = null;
        this._sounds = [];
        this._recordings = [];
        this._activeTab = 'library';
        this._categories = [];

        if (this.container) this.render();
    }

    render() {
        const c = this.container;
        c.innerHTML = '';
        c.style.cssText = 'background:var(--bg-panel,#161b22);border:1px solid var(--border,#30363d);border-radius:8px;font-family:inherit;display:flex;flex-direction:column;height:100%;overflow:hidden';

        // Tabs
        const tabs = document.createElement('div');
        tabs.style.cssText = 'display:flex;border-bottom:1px solid var(--border,#30363d);flex-shrink:0';
        const tabData = [
            { id: 'library', icon: 'library_music', label: 'Library' },
            { id: 'recordings', icon: 'mic', label: 'Opnames' },
            { id: 'browse', icon: 'search', label: 'Zoek Online' },
        ];
        if (!this.showRecordings) tabData.splice(1, 1);
        tabData.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'lp-tab';
            btn.dataset.tab = t.id;
            btn.style.cssText = `flex:1;padding:8px 4px;border:none;background:${t.id === this._activeTab ? 'var(--bg-dark,#0d1117)' : 'transparent'};color:${t.id === this._activeTab ? 'var(--accent,#4a9eff)' : 'var(--text-dim,#8b949e)'};cursor:pointer;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;border-bottom:${t.id === this._activeTab ? '2px solid var(--accent,#4a9eff)' : '2px solid transparent'};transition:all 0.15s`;
            btn.innerHTML = `<span class="material-icons" style="font-size:14px">${t.icon}</span>${t.label}`;
            btn.onclick = () => this._switchTab(t.id);
            tabs.appendChild(btn);
        });
        c.appendChild(tabs);

        // Search bar
        const search = document.createElement('div');
        search.style.cssText = 'display:flex;gap:4px;padding:8px;flex-shrink:0';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Zoek...';
        input.id = 'lp-search';
        input.style.cssText = 'flex:1;background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d);border-radius:6px;color:var(--text,#e0e0ee);padding:6px 10px;font-size:11px;outline:none';
        input.oninput = () => this._filterResults();
        search.appendChild(input);

        if (!this.compact) {
            const scanBtn = document.createElement('button');
            scanBtn.textContent = 'Scan PC';
            scanBtn.style.cssText = 'padding:6px 8px;background:var(--accent,#4a9eff);border:none;border-radius:6px;color:#fff;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap';
            scanBtn.onclick = () => this._scanPC();
            search.appendChild(scanBtn);
        }
        c.appendChild(search);

        // Filters
        if (this.showFilters && !this.compact) {
            const filters = document.createElement('div');
            filters.id = 'lp-filters';
            filters.style.cssText = 'display:flex;gap:4px;padding:0 8px 6px;flex-wrap:wrap;flex-shrink:0';
            const selectStyle = 'background:var(--bg-dark,#0d1117);border:1px solid var(--border,#30363d);border-radius:4px;color:var(--text-dim,#8b949e);font-size:10px;padding:2px 4px;cursor:pointer';

            // Category filter
            const catSel = document.createElement('select');
            catSel.id = 'lp-cat';
            catSel.style.cssText = selectStyle;
            catSel.innerHTML = '<option value="">Categorie</option>';
            catSel.onchange = () => this._filterResults();
            filters.appendChild(catSel);

            // BPM filter
            const bpmSel = document.createElement('select');
            bpmSel.id = 'lp-bpm';
            bpmSel.style.cssText = selectStyle;
            bpmSel.innerHTML = '<option value="">BPM</option><option value="60-90">60-90</option><option value="90-110">90-110</option><option value="110-130">110-130</option><option value="130-150">130-150</option><option value="150+">150+</option>';
            bpmSel.onchange = () => this._filterResults();
            filters.appendChild(bpmSel);

            // Duration filter
            const durSel = document.createElement('select');
            durSel.id = 'lp-dur';
            durSel.style.cssText = selectStyle;
            durSel.innerHTML = '<option value="">Duur</option><option value="0-1000">&lt;1s</option><option value="1000-5000">1-5s</option><option value="5000-15000">5-15s</option><option value="15000-60000">15-60s</option><option value="60000+">60s+</option>';
            durSel.onchange = () => this._filterResults();
            filters.appendChild(durSel);

            // Count
            const count = document.createElement('span');
            count.id = 'lp-count';
            count.style.cssText = 'font-size:9px;color:var(--text-dim,#8b949e);margin-left:auto;display:flex;align-items:center';
            count.textContent = '0 sounds';
            filters.appendChild(count);

            c.appendChild(filters);
        }

        // Category chips
        if (this.showCategories) {
            const chips = document.createElement('div');
            chips.id = 'lp-chips';
            chips.style.cssText = 'display:flex;gap:3px;padding:0 8px 6px;flex-wrap:wrap;flex-shrink:0';
            c.appendChild(chips);
        }

        // Results grid
        const grid = document.createElement('div');
        grid.id = 'lp-grid';
        grid.style.cssText = 'flex:1;overflow-y:auto;padding:0 8px 8px';
        c.appendChild(grid);

        // Audio Browser container (hidden initially)
        const browserContainer = document.createElement('div');
        browserContainer.id = 'lp-browser';
        browserContainer.style.cssText = 'display:none;flex:1;overflow-y:auto;padding:8px';
        c.appendChild(browserContainer);

        // Recordings container (hidden initially)
        const recContainer = document.createElement('div');
        recContainer.id = 'lp-recordings';
        recContainer.style.cssText = 'display:none;flex:1;overflow-y:auto;padding:8px';
        c.appendChild(recContainer);

        // Load data
        this._loadLibrary();
        this._loadCategories();
    }

    _switchTab(tab) {
        this._activeTab = tab;
        // Update tab buttons
        this.container.querySelectorAll('.lp-tab').forEach(btn => {
            const active = btn.dataset.tab === tab;
            btn.style.background = active ? 'var(--bg-dark,#0d1117)' : 'transparent';
            btn.style.color = active ? 'var(--accent,#4a9eff)' : 'var(--text-dim,#8b949e)';
            btn.style.borderBottom = active ? '2px solid var(--accent,#4a9eff)' : '2px solid transparent';
        });

        // Show/hide panels
        const grid = document.getElementById('lp-grid');
        const browser = document.getElementById('lp-browser');
        const recs = document.getElementById('lp-recordings');
        const filters = document.getElementById('lp-filters');
        const chips = document.getElementById('lp-chips');

        if (grid) grid.style.display = tab === 'library' ? 'block' : 'none';
        if (browser) browser.style.display = tab === 'browse' ? 'block' : 'none';
        if (recs) recs.style.display = tab === 'recordings' ? 'block' : 'none';
        if (filters) filters.style.display = tab === 'library' ? 'flex' : 'none';
        if (chips) chips.style.display = tab === 'library' ? 'flex' : 'none';

        if (tab === 'browse' && !this._browserInit) {
            this._browserInit = true;
            if (typeof AudioBrowser !== 'undefined') {
                new AudioBrowser({
                    container: document.getElementById('lp-browser'),
                    onSelect: (audioBuffer, name) => {
                        if (this.onSelectBuffer) this.onSelectBuffer(audioBuffer, name);
                        this.onSelect(null, name, { buffer: audioBuffer });
                    },
                    compact: this.compact
                });
            } else {
                document.getElementById('lp-browser').innerHTML = '<div style="color:var(--text-dim);font-size:11px;padding:20px;text-align:center">Audio Browser niet beschikbaar. Voeg audio-browser.js toe.</div>';
            }
        }

        if (tab === 'recordings') {
            this._loadRecordings();
        }
    }

    async _loadLibrary() {
        const grid = document.getElementById('lp-grid');
        if (!grid) return;
        grid.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:20px;text-align:center">Laden...</div>';

        try {
            const resp = await fetch('/api/sounds');
            if (!resp.ok) throw new Error();
            this._sounds = await resp.json();
            this._renderGrid(this._sounds);
        } catch(e) {
            grid.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:20px;text-align:center">Library niet beschikbaar (alleen op localhost)</div>';
        }
    }

    async _loadCategories() {
        try {
            const resp = await fetch('/api/categories');
            if (!resp.ok) return;
            this._categories = await resp.json();
            const catSel = document.getElementById('lp-cat');
            if (catSel) {
                this._categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    opt.textContent = c.name;
                    catSel.appendChild(opt);
                });
            }
            const chips = document.getElementById('lp-chips');
            if (chips && this._categories.length) {
                chips.innerHTML = this._categories.map(c =>
                    `<button onclick="this.classList.toggle('active');document.getElementById('lp-cat').value=this.classList.contains('active')?'${c.name}':'';document.getElementById('lp-cat').dispatchEvent(new Event('change'))" style="font-size:9px;padding:2px 8px;border-radius:12px;border:1px solid var(--border,#30363d);background:var(--bg-dark,#0d1117);color:var(--text-dim,#8b949e);cursor:pointer;transition:all 0.15s">${c.name} <span style="font-size:8px;opacity:0.6">${c.sound_count || ''}</span></button>`
                ).join('');
            }
        } catch(e) {}
    }

    _filterResults() {
        const q = (document.getElementById('lp-search')?.value || '').toLowerCase();
        const cat = document.getElementById('lp-cat')?.value || '';
        const bpm = document.getElementById('lp-bpm')?.value || '';
        const dur = document.getElementById('lp-dur')?.value || '';

        let filtered = this._sounds.filter(s => {
            if (q && !(s.name || '').toLowerCase().includes(q) && !(s.tags || []).some(t => t.includes(q))) return false;
            if (cat && s.category_name !== cat) return false;
            if (bpm) {
                const [min, max] = bpm.replace('+','').split('-').map(Number);
                if (!s.bpm) return false;
                if (bpm.includes('+')) { if (s.bpm < min) return false; }
                else { if (s.bpm < min || s.bpm > max) return false; }
            }
            if (dur) {
                const [min, max] = dur.replace('+','').split('-').map(Number);
                if (!s.duration_ms) return false;
                if (dur.includes('+')) { if (s.duration_ms < min) return false; }
                else { if (s.duration_ms < min || s.duration_ms > max) return false; }
            }
            return true;
        });

        const count = document.getElementById('lp-count');
        if (count) count.textContent = `${filtered.length} sound${filtered.length !== 1 ? 's' : ''}`;
        this._renderGrid(filtered);
    }

    _renderGrid(sounds) {
        const grid = document.getElementById('lp-grid');
        if (!grid) return;
        if (!sounds.length) {
            grid.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:20px;text-align:center">Geen sounds gevonden</div>';
            return;
        }
        grid.innerHTML = sounds.map((s, i) => {
            const dur = s.duration_ms ? (s.duration_ms / 1000).toFixed(1) + 's' : '';
            const bpm = s.bpm ? `${Math.round(s.bpm)} BPM` : '';
            const meta = [s.category_name, bpm, dur].filter(Boolean).join(' · ');
            return `<div class="lp-item" data-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-radius:6px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid var(--border,#30363d)22">
                <span class="material-icons" style="font-size:16px;color:var(--accent,#4a9eff);cursor:pointer;flex-shrink:0" data-preview="${i}" title="Preview">play_circle</span>
                <div style="flex:1;min-width:0">
                    <div style="font-size:11px;font-weight:500;color:var(--text,#e0e0ee);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${s.name}">${s.name}</div>
                    <div style="font-size:9px;color:var(--text-dim,#8b949e)">${meta}</div>
                </div>
                <span style="font-size:8px;color:var(--text-dim,#8b949e)">${s.file_format || ''}</span>
            </div>`;
        }).join('');

        grid.querySelectorAll('.lp-item').forEach(el => {
            el.onmouseover = () => { el.style.background = 'var(--bg-hover,#242d3d)'; };
            el.onmouseout = () => { el.style.background = 'transparent'; };
            el.onclick = (e) => {
                if (e.target.dataset.preview !== undefined) {
                    this._previewSound(sounds[+e.target.dataset.preview]);
                    return;
                }
                const s = sounds[+el.dataset.idx];
                if (s) {
                    const url = `/api/local-audio?path=${encodeURIComponent(s.file_path || s.filename)}`;
                    this.onSelect(url, s.name, s);
                }
            };
        });
    }

    _loadRecordings() {
        const container = document.getElementById('lp-recordings');
        if (!container) return;
        const recs = JSON.parse(localStorage.getItem('daw-recordings') || '[]');
        if (!recs.length) {
            container.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:20px;text-align:center"><span class="material-icons" style="font-size:32px;display:block;margin-bottom:8px;opacity:0.3">mic</span>Geen opnames.<br>Maak een opname in de Studio, Sampler of DJ App.</div>';
            return;
        }
        container.innerHTML = recs.map((r, i) => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;border-bottom:1px solid var(--border,#30363d)22;transition:background 0.15s" onmouseover="this.style.background='var(--bg-hover,#242d3d)'" onmouseout="this.style.background='transparent'" onclick="this.closest('[id]').__panel.onSelect('${r.url}','${r.name}',${JSON.stringify(r).replace(/'/g,"\\'")})">
                <span class="material-icons" style="font-size:16px;color:var(--red,#ff4a5a)">mic</span>
                <div style="flex:1">
                    <div style="font-size:11px;font-weight:500;color:var(--text,#e0e0ee)">${r.name}</div>
                    <div style="font-size:9px;color:var(--text-dim,#8b949e)">${r.date || ''} · ${r.duration || ''}</div>
                </div>
                <button onclick="event.stopPropagation();LibraryPanel.deleteRecording(${i})" style="background:none;border:none;color:var(--text-dim,#8b949e);cursor:pointer;font-size:14px" title="Verwijder">&times;</button>
            </div>
        `).join('');
        container.__panel = this;
    }

    async _scanPC() {
        const grid = document.getElementById('lp-grid');
        if (!grid) return;
        grid.innerHTML = '<div style="color:var(--text-dim,#8b949e);font-size:11px;padding:20px;text-align:center">Scannen...</div>';
        try {
            const resp = await fetch('/api/scan-audio?path=audio');
            const data = await resp.json();
            const files = data.results || [];
            this._sounds = files.map(f => ({
                name: f.name,
                filename: f.path,
                file_path: f.path,
                category_name: 'Lokaal',
                file_format: f.name.split('.').pop()
            }));
            this._renderGrid(this._sounds);
        } catch(e) {
            grid.innerHTML = '<div style="color:var(--red,#ff4a5a);font-size:11px;padding:20px;text-align:center">Scan niet beschikbaar (alleen op localhost)</div>';
        }
    }

    async _previewSound(sound) {
        if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this._previewSource) { try { this._previewSource.stop(); } catch(e) {} }
        try {
            const url = sound.file_path ? `/api/local-audio?path=${encodeURIComponent(sound.file_path)}` : `/api/local-audio?path=${encodeURIComponent(sound.filename)}`;
            const resp = await fetch(url);
            const buf = await resp.arrayBuffer();
            const audioBuffer = await this._audioCtx.decodeAudioData(buf);
            const src = this._audioCtx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(this._audioCtx.destination);
            src.start();
            this._previewSource = src;
            setTimeout(() => { try { src.stop(); } catch(e) {} }, 10000);
        } catch(e) {}
    }

    // Static: opname opslaan (aanroepen vanuit andere pagina's)
    static saveRecording(name, url, duration) {
        const recs = JSON.parse(localStorage.getItem('daw-recordings') || '[]');
        recs.unshift({
            name: name || `Opname ${recs.length + 1}`,
            url,
            date: new Date().toLocaleString('nl-NL'),
            duration: duration || ''
        });
        // Max 50 opnames
        if (recs.length > 50) recs.length = 50;
        localStorage.setItem('daw-recordings', JSON.stringify(recs));
    }

    static deleteRecording(index) {
        const recs = JSON.parse(localStorage.getItem('daw-recordings') || '[]');
        recs.splice(index, 1);
        localStorage.setItem('daw-recordings', JSON.stringify(recs));
        // Re-render als panel open is
        const container = document.getElementById('lp-recordings');
        if (container && container.__panel) container.__panel._loadRecordings();
    }
}

if (typeof module !== 'undefined') module.exports = LibraryPanel;
