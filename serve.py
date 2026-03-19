"""
DAW Server - port 8086
Launcher voor api_server.py (Flask) die zowel statische bestanden
als de /api/* endpoints serveert.
"""
import runpy
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Start api_server.py als main module
sys.argv = [os.path.join(os.path.dirname(__file__), 'api_server.py')]
runpy.run_path('api_server.py', run_name='__main__')
