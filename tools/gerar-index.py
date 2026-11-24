# Gera o index.html do site a partir do arquivo do app no Claude (faturas.html).
# Uso: python3 tools/gerar-index.py caminho/para/faturas.html
import sys, pathlib

src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
title = "<title>Financeiro Casagrande</title>"
src = src.replace(title, "", 1).replace('<meta name="claude:viewport-fit-sides" content="cover">', "", 1)
head = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
""" + title + """
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#141C2B"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Financeiro"><meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="manifest.webmanifest?v=2"><link rel="icon" href="icon-192-v2.png"><link rel="apple-touch-icon" href="apple-touch-icon-v2.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script><script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script><script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-shim.js"></script>
</head>
<body>
"""
out = head + src + "\n</body>\n</html>\n"
pathlib.Path("index.html").write_text(out, encoding="utf-8")
print("index.html gerado:", len(out), "bytes")
