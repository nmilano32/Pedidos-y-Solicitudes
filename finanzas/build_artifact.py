#!/usr/bin/env python3
"""Genera la página única para publicar como Artifact de Claude a partir de index.html, styles.css y app.js.

Uso: python3 build_artifact.py salida.html
"""
import re
import sys
from pathlib import Path

root = Path(__file__).parent
html = (root / "index.html").read_text()
css = (root / "styles.css").read_text()
js = (root / "app.js").read_text()

title = re.search(r"<title>.*?</title>", html, re.S).group(0)
fonts = "\n".join(re.findall(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts[^>]*>', html))
body = html.split("<body>", 1)[1].split('<script src="app.js">', 1)[0]

out = f"{title}\n{fonts}\n<style>\n{css}</style>\n{body}<script>\n{js}</script>\n"
Path(sys.argv[1]).write_text(out)
