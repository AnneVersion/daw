-- ============================================================
-- DAW Community Platform - Supabase Schema
-- Voer dit uit in je Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. COMMUNITY TRACKS - Volledige nummers, mixes, DJ sets
-- ============================================================
CREATE TABLE IF NOT EXISTS community_tracks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT DEFAULT 'Anonymous',
    description TEXT,
    file_path TEXT NOT NULL,
    cover_path TEXT,
    category TEXT DEFAULT 'overig',
    genre TEXT,
    tags TEXT[] DEFAULT '{}',
    bpm INTEGER,
    key TEXT,
    duration_ms INTEGER,
    size_bytes INTEGER,
    format TEXT DEFAULT 'webm',
    source TEXT DEFAULT 'daw',          -- daw, dj, sampler, editor, synth
    plays INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_genre ON community_tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_tags ON community_tracks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_tracks_source ON community_tracks(source);
CREATE INDEX IF NOT EXISTS idx_tracks_created ON community_tracks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_likes ON community_tracks(likes DESC);

ALTER TABLE community_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracks_select" ON community_tracks FOR SELECT USING (true);
CREATE POLICY "tracks_insert" ON community_tracks FOR INSERT WITH CHECK (true);
CREATE POLICY "tracks_update" ON community_tracks FOR UPDATE USING (true);

-- ============================================================
-- 2. COMMUNITY PATTERNS - Step sequencer patterns
-- ============================================================
CREATE TABLE IF NOT EXISTS community_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    tags TEXT[] DEFAULT '{}',
    bpm INTEGER DEFAULT 120,
    swing INTEGER DEFAULT 0,
    pattern_data JSONB NOT NULL,        -- { pads: [...], steps: [[...]] }
    pad_names TEXT[] DEFAULT '{}',
    creator TEXT DEFAULT 'Anonymous',
    likes INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patterns_genre ON community_patterns(genre);
CREATE INDEX IF NOT EXISTS idx_patterns_tags ON community_patterns USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_patterns_created ON community_patterns(created_at DESC);

ALTER TABLE community_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patterns_select" ON community_patterns FOR SELECT USING (true);
CREATE POLICY "patterns_insert" ON community_patterns FOR INSERT WITH CHECK (true);

-- ============================================================
-- 3. COMMUNITY PRESETS - Synth, FX, mixer instellingen
-- ============================================================
CREATE TABLE IF NOT EXISTS community_presets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,                 -- synth, fx, mixer, sampler_kit
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    preset_data JSONB NOT NULL,         -- Alle instellingen als JSON
    creator TEXT DEFAULT 'Anonymous',
    likes INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presets_type ON community_presets(type);
CREATE INDEX IF NOT EXISTS idx_presets_tags ON community_presets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_presets_created ON community_presets(created_at DESC);

ALTER TABLE community_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presets_select" ON community_presets FOR SELECT USING (true);
CREATE POLICY "presets_insert" ON community_presets FOR INSERT WITH CHECK (true);

-- ============================================================
-- 4. COMMUNITY PROJECTS - DAW projecten (timeline + mixer)
-- ============================================================
CREATE TABLE IF NOT EXISTS community_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    tags TEXT[] DEFAULT '{}',
    bpm INTEGER DEFAULT 120,
    project_data JSONB NOT NULL,        -- Volledige DAW state
    preview_path TEXT,                  -- Audio preview
    creator TEXT DEFAULT 'Anonymous',
    likes INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_genre ON community_projects(genre);
CREATE INDEX IF NOT EXISTS idx_projects_tags ON community_projects USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_projects_created ON community_projects(created_at DESC);

ALTER TABLE community_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_select" ON community_projects FOR SELECT USING (true);
CREATE POLICY "projects_insert" ON community_projects FOR INSERT WITH CHECK (true);

-- ============================================================
-- 5. STORAGE BUCKETS
-- ============================================================
-- Maak deze aan via Supabase Dashboard > Storage:
--   - samples     (al aangemaakt) - community samples
--   - tracks      - volledige nummers, mixes, DJ sets
--   - previews    - audio previews van projecten
--   - covers      - album art / covers
--
-- Alle buckets: public = true

-- ============================================================
-- 6. LIKES TABEL (voorkom dubbel liken)
-- ============================================================
CREATE TABLE IF NOT EXISTS community_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_type TEXT NOT NULL,         -- sample, track, pattern, preset, project
    content_id UUID NOT NULL,
    user_fingerprint TEXT NOT NULL,     -- browser fingerprint (geen login nodig)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_type, content_id, user_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_likes_content ON community_likes(content_type, content_id);

ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select" ON community_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON community_likes FOR INSERT WITH CHECK (true);
