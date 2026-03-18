-- Default categorieën voor geluidsbibliotheek
INSERT INTO categories (name, icon, sort_order) VALUES
    ('Drums',    'drum',    1),
    ('Bass',     'bass',    2),
    ('Keys',     'piano',   3),
    ('Guitar',   'guitar',  4),
    ('Vocals',   'mic',     5),
    ('FX',       'fx',      6),
    ('Synth',    'synth',   7),
    ('Strings',  'violin',  8),
    ('Brass',    'trumpet', 9),
    ('Field Recording', 'field', 10),
    ('Loops',    'loop',    11),
    ('One-shots','oneshot', 12),
    ('Other',    'other',   99)
ON CONFLICT (name) DO NOTHING;

-- Subcategorieën drums
INSERT INTO categories (name, parent_id, icon, sort_order)
SELECT sub.name, c.id, sub.icon, sub.sort_order
FROM categories c,
(VALUES
    ('Kick',  'kick',  1),
    ('Snare', 'snare', 2),
    ('Hi-Hat','hihat', 3),
    ('Clap',  'clap',  4),
    ('Percussion', 'perc', 5)
) AS sub(name, icon, sort_order)
WHERE c.name = 'Drums'
ON CONFLICT (name) DO NOTHING;
