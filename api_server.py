"""
DAW API Server - Flask backend voor sound library en projecten.
Port: 8085 (API), serve.py voor statische bestanden.
Database: PostgreSQL 'daw'
"""
import os, uuid, json
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_file, abort
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from mutagen import File as MutagenFile
from mutagen.wave import WAVE
from mutagen.mp3 import MP3

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

BASE_DIR = Path(__file__).parent
AUDIO_DIR = BASE_DIR / 'audio'
AUDIO_DIR.mkdir(exist_ok=True)

# --- Database ---
def get_db():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'daw'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASS', ''),
        port=os.getenv('DB_PORT', '5432')
    )
    conn.autocommit = True
    return conn

def query(sql, params=None, fetch='all'):
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == 'all':
                return cur.fetchall()
            elif fetch == 'one':
                return cur.fetchone()
            elif fetch == 'none':
                return None

# --- Static files ---
@app.route('/')
def index():
    return send_file('index.html')

@app.route('/worklets/<path:filename>')
def worklet(filename):
    return send_file(f'worklets/{filename}', mimetype='application/javascript')

# --- Projects API ---
@app.route('/api/projects', methods=['GET'])
def list_projects():
    rows = query("""
        SELECT id, name, bpm, time_sig_num, time_sig_den, sample_rate,
               created_at, updated_at
        FROM projects ORDER BY updated_at DESC
    """)
    return jsonify([{**r, 'id': str(r['id']),
                     'created_at': r['created_at'].isoformat(),
                     'updated_at': r['updated_at'].isoformat()} for r in rows])

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json or {}
    row = query("""
        INSERT INTO projects (name, bpm, time_sig_num, time_sig_den)
        VALUES (%s, %s, %s, %s)
        RETURNING id, name, bpm, time_sig_num, time_sig_den, project_data, created_at, updated_at
    """, (
        data.get('name', 'Nieuw Project'),
        data.get('bpm', 120),
        data.get('time_sig_num', 4),
        data.get('time_sig_den', 4)
    ), fetch='one')
    return jsonify({**row, 'id': str(row['id']),
                    'created_at': row['created_at'].isoformat(),
                    'updated_at': row['updated_at'].isoformat()}), 201

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    row = query("SELECT * FROM projects WHERE id = %s", (project_id,), fetch='one')
    if not row:
        abort(404)
    return jsonify({**row, 'id': str(row['id']),
                    'created_at': row['created_at'].isoformat(),
                    'updated_at': row['updated_at'].isoformat()})

@app.route('/api/projects/<project_id>', methods=['PUT'])
def save_project(project_id):
    data = request.json
    row = query("""
        UPDATE projects SET
            name = COALESCE(%s, name),
            bpm = COALESCE(%s, bpm),
            time_sig_num = COALESCE(%s, time_sig_num),
            time_sig_den = COALESCE(%s, time_sig_den),
            project_data = COALESCE(%s, project_data),
            updated_at = NOW()
        WHERE id = %s
        RETURNING id, name, updated_at
    """, (
        data.get('name'),
        data.get('bpm'),
        data.get('time_sig_num'),
        data.get('time_sig_den'),
        Json(data['project_data']) if 'project_data' in data else None,
        project_id
    ), fetch='one')
    if not row:
        abort(404)
    return jsonify({**row, 'id': str(row['id']), 'updated_at': row['updated_at'].isoformat()})

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    query("DELETE FROM projects WHERE id = %s", (project_id,), fetch='none')
    return '', 204

# --- Sounds API ---
@app.route('/api/sounds', methods=['GET'])
def list_sounds():
    conditions = ["1=1"]
    params = []

    q = request.args.get('q')
    if q:
        conditions.append("(name ILIKE %s OR %s = ANY(tags))")
        params.extend([f'%{q}%', q.lower()])

    cat = request.args.get('category')
    if cat:
        conditions.append("category_id = %s")
        params.append(int(cat))

    tag = request.args.get('tag')
    if tag:
        conditions.append("%s = ANY(tags)")
        params.append(tag.lower())

    bpm_min = request.args.get('bpm_min')
    if bpm_min:
        conditions.append("bpm >= %s")
        params.append(float(bpm_min))

    bpm_max = request.args.get('bpm_max')
    if bpm_max:
        conditions.append("bpm <= %s")
        params.append(float(bpm_max))

    key = request.args.get('key')
    if key:
        conditions.append("musical_key = %s")
        params.append(key)

    fav = request.args.get('favorite')
    if fav == 'true':
        conditions.append("is_favorite = TRUE")

    where = " AND ".join(conditions)
    rows = query(f"""
        SELECT s.*, c.name as category_name
        FROM sounds s
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE {where}
        ORDER BY s.created_at DESC
        LIMIT 200
    """, params)

    return jsonify([{
        **r,
        'id': str(r['id']),
        'created_at': r['created_at'].isoformat(),
        'updated_at': r['updated_at'].isoformat()
    } for r in rows])

@app.route('/api/sounds/upload', methods=['POST'])
def upload_sound():
    if 'file' not in request.files:
        return jsonify({'error': 'Geen bestand meegegeven'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Geen bestandsnaam'}), 400

    ext = Path(file.filename).suffix.lower()
    if ext not in ('.wav', '.mp3', '.ogg', '.flac'):
        return jsonify({'error': f'Ongeldig formaat: {ext}'}), 400

    # Bepaal categorie en opslaglocatie
    category_id = request.form.get('category_id')
    category_name = 'other'
    if category_id:
        cat = query("SELECT name FROM categories WHERE id = %s", (int(category_id),), fetch='one')
        if cat:
            category_name = cat['name'].lower().replace(' ', '_')

    # Sla bestand op
    file_uuid = str(uuid.uuid4())
    rel_path = f"samples/{category_name}/{file_uuid}{ext}"
    abs_path = AUDIO_DIR / rel_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    file.save(str(abs_path))

    # Metadata extractie
    duration_ms = 0
    sample_rate = 44100
    channels = 2
    bit_depth = 16

    try:
        audio = MutagenFile(str(abs_path))
        if audio:
            duration_ms = int((audio.info.length or 0) * 1000)
            sample_rate = getattr(audio.info, 'sample_rate', 44100)
            channels = getattr(audio.info, 'channels', 2)
            bit_depth = getattr(audio.info, 'bits_per_sample', 16)
    except Exception as e:
        print(f"Metadata extractie fout: {e}")

    file_size = abs_path.stat().st_size
    name = request.form.get('name', Path(file.filename).stem)
    tags_raw = request.form.get('tags', '')
    tags = [t.strip().lower() for t in tags_raw.split(',') if t.strip()]
    bpm = request.form.get('bpm')
    musical_key = request.form.get('key')

    row = query("""
        INSERT INTO sounds (name, filename, category_id, duration_ms, sample_rate,
            channels, bit_depth, file_size, bpm, musical_key, tags, source, file_format)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, name, duration_ms, file_format, created_at
    """, (
        name, rel_path, int(category_id) if category_id else None,
        duration_ms, sample_rate, channels, bit_depth, file_size,
        float(bpm) if bpm else None,
        musical_key,
        tags, 'upload', ext.lstrip('.')
    ), fetch='one')

    return jsonify({**row, 'id': str(row['id']),
                    'created_at': row['created_at'].isoformat()}), 201

@app.route('/api/sounds/<sound_id>/file', methods=['GET'])
def get_sound_file(sound_id):
    row = query("SELECT filename, file_format FROM sounds WHERE id = %s",
                (sound_id,), fetch='one')
    if not row:
        abort(404)
    path = AUDIO_DIR / row['filename']
    if not path.exists():
        abort(404)
    mimetypes = {'wav': 'audio/wav', 'mp3': 'audio/mpeg',
                 'ogg': 'audio/ogg', 'flac': 'audio/flac'}
    return send_file(str(path), mimetype=mimetypes.get(row['file_format'], 'audio/wav'))

@app.route('/api/sounds/<sound_id>/favorite', methods=['PUT'])
def toggle_favorite(sound_id):
    row = query("""
        UPDATE sounds SET is_favorite = NOT is_favorite, updated_at = NOW()
        WHERE id = %s RETURNING id, is_favorite
    """, (sound_id,), fetch='one')
    if not row:
        abort(404)
    return jsonify({'id': str(row['id']), 'is_favorite': row['is_favorite']})

@app.route('/api/sounds/<sound_id>', methods=['DELETE'])
def delete_sound(sound_id):
    row = query("SELECT filename FROM sounds WHERE id = %s", (sound_id,), fetch='one')
    if row:
        path = AUDIO_DIR / row['filename']
        if path.exists():
            path.unlink()
        query("DELETE FROM sounds WHERE id = %s", (sound_id,), fetch='none')
    return '', 204

# --- Categories API ---
@app.route('/api/categories', methods=['GET'])
def list_categories():
    rows = query("""
        SELECT c.*, COUNT(s.id) as sound_count
        FROM categories c
        LEFT JOIN sounds s ON s.category_id = c.id
        GROUP BY c.id
        ORDER BY c.sort_order
    """)
    return jsonify(rows)

# --- Start ---
if __name__ == '__main__':
    print("DAW API Server: http://localhost:8085")
    print("Database:", os.getenv('DB_NAME', 'daw'))
    app.run(host='0.0.0.0', port=8085, debug=True)
