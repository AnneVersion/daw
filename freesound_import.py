"""
Freesound Import Script - Vult de DAW sound library met samples van Freesound.org

Gebruik:
    1. Maak een gratis API key aan: https://freesound.org/apiv2/apply/
    2. Zet de key in .env: FREESOUND_API_KEY=jouw-key
    3. Run: python freesound_import.py

Opties:
    python freesound_import.py                    # Importeer alle categorieën
    python freesound_import.py --category drums   # Alleen drums
    python freesound_import.py --max 10           # Max 10 samples per categorie
    python freesound_import.py --preview          # Alleen tonen, niet downloaden
"""
import os, sys, json, uuid, time, argparse
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import psycopg2
from psycopg2.extras import RealDictCursor

# Config
API_BASE = 'https://freesound.org/apiv2'
AUDIO_DIR = Path(__file__).parent / 'audio' / 'samples'

# Zoektermen per categorie (categorie_naam -> freesound query)
CATEGORY_QUERIES = {
    'Drums':     ['drum loop', 'kick drum', 'snare hit', 'hi-hat', 'cymbal crash'],
    'Bass':      ['bass synth', 'bass guitar', 'sub bass', '808 bass'],
    'Keys':      ['piano chord', 'piano loop', 'organ', 'electric piano'],
    'Guitar':    ['guitar riff', 'acoustic guitar', 'electric guitar clean', 'guitar strum'],
    'Vocals':    ['vocal chop', 'vocal sample', 'choir', 'vocal harmony'],
    'FX':        ['riser', 'impact sound', 'whoosh', 'transition fx', 'reverse cymbal'],
    'Synth':     ['synth pad', 'synth lead', 'arpeggio synth', 'ambient pad'],
    'Strings':   ['violin', 'cello', 'string ensemble', 'orchestral strings'],
    'Brass':     ['trumpet', 'trombone', 'french horn', 'brass ensemble'],
    'Percussion': ['bongo', 'conga', 'tambourine', 'shaker', 'cowbell'],
    'Loops':     ['beat loop', 'music loop 120bpm', 'groove loop'],
    'One-shots': ['one shot', 'stab', 'hit', 'pluck'],
    'Field Recording': ['nature ambient', 'city sounds', 'rain', 'birds singing'],
}

def get_api_key():
    key = os.getenv('FREESOUND_API_KEY', '')
    if not key:
        env_path = Path(__file__).parent / '.env'
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith('FREESOUND_API_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"\'')
    if not key:
        print("FOUT: Geen Freesound API key gevonden!")
        print("1. Ga naar https://freesound.org/apiv2/apply/")
        print("2. Maak een gratis API key aan")
        print("3. Voeg toe aan .env: FREESOUND_API_KEY=jouw-key")
        sys.exit(1)
    return key

def get_db():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'daw'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASS', ''),
        port=os.getenv('DB_PORT', '5432')
    )

def api_request(endpoint, api_key, params=None):
    """Maak een API request naar Freesound."""
    url = f"{API_BASE}{endpoint}?token={api_key}"
    if params:
        for k, v in params.items():
            url += f"&{k}={v}"

    req = Request(url, headers={'User-Agent': 'DAW-Importer/1.0'})
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        if e.code == 429:
            print("  Rate limit bereikt, wacht 60 seconden...")
            time.sleep(60)
            return api_request(endpoint, api_key, params)
        print(f"  API fout {e.code}: {e.reason}")
        return None

def search_sounds(api_key, query, max_results=5):
    """Zoek geluiden op Freesound."""
    data = api_request('/search/text/', api_key, {
        'query': query,
        'fields': 'id,name,tags,duration,samplerate,channels,bitdepth,filesize,type,avg_rating,num_ratings,previews,ac_analysis',
        'filter': 'duration:[0.1 TO 30] type:(wav OR mp3 OR ogg OR flac)',
        'sort': 'rating_desc',
        'page_size': max_results
    })
    if not data or 'results' not in data:
        return []
    return data['results']

def download_sound(sound_id, api_key, dest_path):
    """Download een geluid van Freesound."""
    # Gebruik de HQ preview (gratis, geen OAuth nodig)
    info = api_request(f'/sounds/{sound_id}/', api_key, {
        'fields': 'previews'
    })
    if not info or 'previews' not in info:
        return False

    preview_url = info['previews'].get('preview-hq-mp3') or info['previews'].get('preview-lq-mp3')
    if not preview_url:
        return False

    try:
        req = Request(preview_url, headers={'User-Agent': 'DAW-Importer/1.0'})
        with urlopen(req) as resp:
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(resp.read())
        return True
    except Exception as e:
        print(f"  Download fout: {e}")
        return False

def extract_bpm_key(sound):
    """Probeer BPM en toonsoort te halen uit Freesound analyse."""
    ac = sound.get('ac_analysis', {})
    bpm = None
    key = None

    if ac:
        bpm_val = ac.get('ac_tempo')
        if bpm_val and 40 < float(bpm_val) < 300:
            bpm = round(float(bpm_val), 1)

        key_val = ac.get('ac_note_name')
        if key_val:
            key = key_val

    # Fallback: zoek in tags
    tags = [t.lower() for t in sound.get('tags', [])]
    if not bpm:
        for tag in tags:
            if 'bpm' in tag:
                try:
                    bpm_num = float(''.join(c for c in tag if c.isdigit() or c == '.'))
                    if 40 < bpm_num < 300:
                        bpm = bpm_num
                except ValueError:
                    pass

    return bpm, key

def import_category(api_key, db_conn, category_name, queries, max_per_query=3, preview_only=False):
    """Importeer samples voor een categorie."""
    print(f"\n{'='*50}")
    print(f"Categorie: {category_name}")
    print(f"{'='*50}")

    # Haal category_id op
    with db_conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id FROM categories WHERE name = %s", (category_name,))
        cat = cur.fetchone()
        if not cat:
            print(f"  Categorie '{category_name}' niet gevonden in database, skip...")
            return 0

    category_id = cat['id']
    imported = 0

    for query in queries:
        print(f"\n  Zoeken: '{query}'...")
        sounds = search_sounds(api_key, query, max_per_query)

        if not sounds:
            print(f"  Geen resultaten")
            continue

        for sound in sounds:
            name = sound['name']
            duration = sound.get('duration', 0)
            tags = [t.lower() for t in sound.get('tags', [])][:10]
            bpm, musical_key = extract_bpm_key(sound)

            print(f"  -> {name} ({duration:.1f}s, {sound.get('type','?')})", end='')

            if preview_only:
                print(f" [preview - BPM:{bpm} Key:{musical_key}]")
                continue

            # Check of al geïmporteerd
            with db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id FROM sounds WHERE name = %s AND category_id = %s",
                           (name, category_id))
                if cur.fetchone():
                    print(" [al aanwezig]")
                    continue

            # Download
            file_uuid = str(uuid.uuid4())
            cat_dir = category_name.lower().replace(' ', '_')
            ext = '.mp3'  # Freesound previews zijn MP3
            rel_path = f"samples/{cat_dir}/{file_uuid}{ext}"
            abs_path = Path(__file__).parent / 'audio' / rel_path

            if download_sound(sound['id'], api_key, abs_path):
                file_size = abs_path.stat().st_size

                with db_conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO sounds (name, filename, category_id, duration_ms,
                            sample_rate, channels, bit_depth, file_size, bpm, musical_key,
                            tags, source, file_format)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        name, rel_path, category_id,
                        int(duration * 1000),
                        sound.get('samplerate', 44100),
                        sound.get('channels', 2),
                        sound.get('bitdepth', 16),
                        file_size, bpm, musical_key,
                        tags, 'freesound', 'mp3'
                    ))
                db_conn.commit()
                imported += 1
                print(f" [OK - {file_size/1024:.0f}KB]")
            else:
                print(" [download mislukt]")

            time.sleep(0.5)  # Rate limiting

    print(f"\n  Totaal geïmporteerd: {imported}")
    return imported

def main():
    parser = argparse.ArgumentParser(description='Freesound Sound Library Import')
    parser.add_argument('--category', '-c', help='Alleen deze categorie importeren')
    parser.add_argument('--max', '-m', type=int, default=3, help='Max samples per zoekopdracht (default: 3)')
    parser.add_argument('--preview', '-p', action='store_true', help='Alleen tonen, niet downloaden')
    args = parser.parse_args()

    api_key = get_api_key()
    print(f"Freesound API key: ...{api_key[-6:]}")

    db_conn = get_db()
    print(f"Database: verbonden")

    categories = CATEGORY_QUERIES
    if args.category:
        matching = {k: v for k, v in categories.items() if k.lower() == args.category.lower()}
        if not matching:
            print(f"Categorie '{args.category}' niet gevonden. Beschikbaar: {', '.join(categories.keys())}")
            sys.exit(1)
        categories = matching

    total = 0
    for cat_name, queries in categories.items():
        total += import_category(api_key, db_conn, cat_name, queries,
                                max_per_query=args.max, preview_only=args.preview)

    print(f"\n{'='*50}")
    print(f"KLAAR! Totaal geïmporteerd: {total} samples")
    print(f"{'='*50}")

    db_conn.close()

if __name__ == '__main__':
    main()
