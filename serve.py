"""DAW Development Server - port 8086"""
import http.server
import os

PORT = 8086
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class CORSHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

print(f"DAW server: http://localhost:{PORT}")
http.server.HTTPServer(('', PORT), CORSHandler).serve_forever()
