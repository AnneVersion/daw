-- Community Samples - Supabase tabel + storage bucket
-- Voer dit uit in je Supabase SQL Editor

-- Maak tabel aan
CREATE TABLE IF NOT EXISTS community_samples (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    category TEXT DEFAULT 'overig',
    tags TEXT[] DEFAULT '{}',
    bpm INTEGER,
    key TEXT,
    size_bytes INTEGER,
    format TEXT,
    duration_ms INTEGER,
    uploader TEXT DEFAULT 'anonymous',
    downloads INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index op tags voor snel zoeken
CREATE INDEX IF NOT EXISTS idx_community_samples_tags ON community_samples USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_community_samples_category ON community_samples(category);
CREATE INDEX IF NOT EXISTS idx_community_samples_created ON community_samples(created_at DESC);

-- RLS: iedereen mag lezen, iedereen mag uploaden
ALTER TABLE community_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Iedereen mag samples lezen"
    ON community_samples FOR SELECT
    USING (true);

CREATE POLICY "Iedereen mag samples uploaden"
    ON community_samples FOR INSERT
    WITH CHECK (true);

-- Storage bucket aanmaken (doe dit in Supabase dashboard of via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('samples', 'samples', true);
