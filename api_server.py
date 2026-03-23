"""
DAW API Server - Flask backend voor sound library en projecten.
Port: 8086 (API + static files)
Database: PostgreSQL 'daw'
"""
import os, uuid, json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')
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

# --- Audio Proxy (voor externe streams die CORS blokkeren) ---
import requests as ext_requests

@app.route('/api/proxy/audio')
def proxy_audio():
    """Proxy externe audio URLs om CORS te omzeilen"""
    url = request.args.get('url')
    if not url:
        return jsonify({"error": "url parameter vereist"}), 400
    # Whitelist: alleen bekende muziek API's
    allowed = ['jamendo.com', 'freesound.org', 'freemusicarchive.org', 'archive.org', 'cdn.freesound.org']
    from urllib.parse import urlparse
    host = urlparse(url).hostname or ''
    if not any(d in host for d in allowed):
        return jsonify({"error": "Domein niet toegestaan"}), 403
    try:
        r = ext_requests.get(url, stream=True, timeout=30,
                             headers={'User-Agent': 'DAW-Platform/1.0'})
        from flask import Response
        def generate():
            for chunk in r.iter_content(chunk_size=8192):
                yield chunk
        return Response(generate(),
                       content_type=r.headers.get('content-type', 'audio/mpeg'),
                       headers={
                           'Content-Length': r.headers.get('content-length', ''),
                           'Accept-Ranges': 'bytes',
                           'Access-Control-Allow-Origin': '*'
                       })
    except Exception as e:
        return jsonify({"error": str(e)}), 502

# --- Lokale audio bestanden zoeken ---
@app.route('/api/scan-audio')
def scan_audio():
    """Zoek audio bestanden op de computer."""
    import time
    q = request.args.get('q', '').lower()
    scan_path = request.args.get('path', '')

    # Standaard: scan alle schijven
    home = Path.home()
    default_paths = [
        home,
        Path('C:/Users'),
        Path('D:/'),
        Path('E:/'),
        Path('F:/'),
    ]

    if scan_path:
        p = Path(scan_path)
        if not p.is_absolute():
            p = Path(os.path.dirname(os.path.abspath(__file__))) / p
        search_dirs = [p]
    else:
        search_dirs = [p for p in default_paths if p.exists()]

    # Audio + video bestanden (video bevat ook audio)
    audio_exts = {
        # Audio
        '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff', '.opus', '.webm',
        '.mid', '.midi', '.amr', '.ape', '.mka', '.ra', '.rm', '.snd', '.au', '.gsm',
        '.dss', '.dvf', '.msv', '.nmf', '.oga', '.mogg', '.raw', '.vox', '.tta',
        '.wv', '.8svx', '.cda', '.ac3', '.dts', '.pcm', '.w64', '.rf64',
        # Video (bevat audio)
        '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.3gp', '.ts', '.mts',
    }
    results = []
    start = time.time()
    timeout = 120  # 2 minuten max, geen limiet op aantal

    for search_dir in search_dirs:
        if (time.time() - start) > timeout:
            break
        try:
            for root, dirs, files in os.walk(search_dir):
                if (time.time() - start) > timeout:
                    break
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in (
                    'node_modules', '__pycache__', '.git', 'ProgramData',
                    'Program Files', 'Program Files (x86)', 'Windows', '$Recycle.Bin',
                    'System Volume Information', 'Recovery', '$WinREAgent',
                    'MSOCache', 'PerfLogs', 'Intel'
                )]
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in audio_exts:
                        if q and q not in f.lower() and q not in root.lower():
                            continue
                        filepath = os.path.join(root, f)
                        try:
                            stat = os.stat(filepath)
                            size_mb = round(stat.st_size / (1024 * 1024), 1)
                            results.append({
                                'name': f,
                                'path': filepath.replace('\\', '/'),
                                'ext': ext[1:],
                                'size_mb': size_mb,
                                'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d'),
                                'folder': root.replace('\\', '/')
                            })
                        except (PermissionError, OSError):
                            pass
        except (PermissionError, OSError):
            continue

    results.sort(key=lambda x: x.get('modified', ''), reverse=True)

    return jsonify({
        'results': results,
        'count': len(results),
        'scan_time': round(time.time() - start, 1)
    })


@app.route('/api/local-audio')
def serve_local_audio():
    """Serveer een lokaal audio/video bestand met streaming (range requests)."""
    filepath = request.args.get('path', '')
    if not filepath or not os.path.isfile(filepath):
        return jsonify({"error": "Bestand niet gevonden"}), 404

    allowed_exts = {
        '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff', '.opus', '.webm',
        '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.3gp', '.ts', '.mts',
    }
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in allowed_exts:
        return jsonify({"error": "Geen audio/video bestand"}), 400

    mime_types = {
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
        '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
        '.wma': 'audio/x-ms-wma', '.aiff': 'audio/aiff', '.opus': 'audio/opus',
        '.webm': 'audio/webm',
        '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv',
        '.m4v': 'video/mp4', '.3gp': 'video/3gpp', '.ts': 'video/mp2t', '.mts': 'video/mp2t',
    }
    mimetype = mime_types.get(ext, 'application/octet-stream')

    # Streaming met Range request support (voor grote bestanden)
    file_size = os.path.getsize(filepath)
    range_header = request.headers.get('Range')

    if range_header:
        # Parse Range: bytes=start-end
        byte_start = 0
        byte_end = file_size - 1
        match = __import__('re').match(r'bytes=(\d+)-(\d*)', range_header)
        if match:
            byte_start = int(match.group(1))
            if match.group(2):
                byte_end = int(match.group(2))
        length = byte_end - byte_start + 1

        with open(filepath, 'rb') as f:
            f.seek(byte_start)
            data = f.read(length)

        resp = app.response_class(data, 206, mimetype=mimetype)
        resp.headers['Content-Range'] = f'bytes {byte_start}-{byte_end}/{file_size}'
        resp.headers['Accept-Ranges'] = 'bytes'
        resp.headers['Content-Length'] = length
        return resp

    return send_file(filepath, mimetype=mimetype)


# --- Scan cache: sla resultaten op als lokaal JSON ---
SCAN_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio', 'scan_cache.json')

@app.route('/api/scan-cache', methods=['GET'])
def get_scan_cache():
    """Geeft gecachte scan resultaten terug (snel, geen disk scan)."""
    if os.path.isfile(SCAN_CACHE_FILE):
        with open(SCAN_CACHE_FILE, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify({'results': [], 'count': 0, 'cached': False})

@app.route('/api/scan-cache', methods=['POST'])
def save_scan_cache():
    """Sla scan resultaten op als cache."""
    data = request.get_json()
    os.makedirs(os.path.dirname(SCAN_CACHE_FILE), exist_ok=True)
    with open(SCAN_CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    return jsonify({'saved': True, 'count': data.get('count', 0)})


# --- Opnames opslaan als echte bestanden ---
RECORDINGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio', 'recordings')

@app.route('/api/recordings', methods=['GET'])
def list_recordings():
    """Lijst van opgeslagen opnames."""
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    files = []
    for f in sorted(os.listdir(RECORDINGS_DIR), reverse=True):
        if f.endswith(('.webm', '.wav', '.mp3', '.ogg')):
            path = os.path.join(RECORDINGS_DIR, f)
            stat = os.stat(path)
            files.append({
                'name': f,
                'path': path.replace('\\', '/'),
                'size_mb': round(stat.st_size / (1024*1024), 2),
                'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
            })
    return jsonify(files)

@app.route('/api/recordings', methods=['POST'])
def save_recording():
    """Sla een opname op als bestand (multipart upload)."""
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    if 'audio' not in request.files:
        return jsonify({'error': 'Geen audio bestand'}), 400
    audio = request.files['audio']
    name = request.form.get('name', f'opname-{datetime.now().strftime("%Y%m%d-%H%M%S")}')
    ext = os.path.splitext(audio.filename)[1] if audio.filename else '.webm'
    if not ext:
        ext = '.webm'
    filename = f'{name}{ext}'
    filepath = os.path.join(RECORDINGS_DIR, filename)
    audio.save(filepath)
    return jsonify({
        'saved': True,
        'name': filename,
        'path': filepath.replace('\\', '/'),
        'size_mb': round(os.path.getsize(filepath) / (1024*1024), 2)
    })

@app.route('/api/recordings/<filename>')
def serve_recording(filename):
    """Serveer een opgeslagen opname."""
    filepath = os.path.join(RECORDINGS_DIR, filename)
    if not os.path.isfile(filepath):
        return jsonify({'error': 'Niet gevonden'}), 404
    return send_file(filepath)


# --- Start ---
if __name__ == '__main__':
    print("DAW API Server: http://localhost:8086")
    print(f"Recordings: {RECORDINGS_DIR}")
    print("Database:", os.getenv('DB_NAME', 'daw'))
    app.run(host='0.0.0.0', port=8086, debug=True)
