-- DAW Database Schema
-- PostgreSQL database: daw

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Categorieën voor geluidsbibliotheek
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    icon        VARCHAR(50),
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Geluidsbibliotheek metadata
CREATE TABLE sounds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    filename    VARCHAR(500) NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    duration_ms INTEGER,
    sample_rate INTEGER DEFAULT 44100,
    channels    INTEGER DEFAULT 2,
    bit_depth   INTEGER DEFAULT 16,
    file_size   BIGINT,
    bpm         NUMERIC(6,2),
    musical_key VARCHAR(10),
    tags        TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT FALSE,
    source      VARCHAR(50) DEFAULT 'upload',
    file_format VARCHAR(10) NOT NULL,
    waveform_data JSONB,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- DAW projecten
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    bpm         NUMERIC(6,2) DEFAULT 120,
    time_sig_num INTEGER DEFAULT 4,
    time_sig_den INTEGER DEFAULT 4,
    sample_rate INTEGER DEFAULT 44100,
    project_data JSONB DEFAULT '{"tracks":[],"master":{"volume":1.0}}',
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sounds_tags ON sounds USING GIN(tags);
CREATE INDEX idx_sounds_category ON sounds(category_id);
CREATE INDEX idx_sounds_bpm ON sounds(bpm) WHERE bpm IS NOT NULL;
CREATE INDEX idx_sounds_key ON sounds(musical_key) WHERE musical_key IS NOT NULL;
CREATE INDEX idx_sounds_favorite ON sounds(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_sounds_name_search ON sounds USING GIN(to_tsvector('dutch', name));
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);
