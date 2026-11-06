"""Corte Certo — servidor web.

Serve a interface (static/) e expõe POST /api/analisar, que recebe as 3 fotos
e as preferências do cliente e devolve a análise em JSON.

Sem ANTHROPIC_API_KEY o app roda em modo demonstração, com uma resposta fixa.
"""

from __future__ import annotations

import logging
import os
import time

from flask import Flask, jsonify, request, send_from_directory

from demo import DEMO_RESULT

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB para as 3 fotos juntas
logging.basicConfig(level=logging.INFO)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
PHOTO_FIELDS = {"esquerda": "foto_esquerda", "frente": "foto_frente", "direita": "foto_direita"}
DEMO_MODE = not os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("DEMO_MODE") == "1"


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/status")
def status():
    return jsonify({"ok": True, "demo": DEMO_MODE})


@app.post("/api/analisar")
def analisar():
    photos: dict[str, tuple[bytes, str]] = {}
    for key, field in PHOTO_FIELDS.items():
        f = request.files.get(field)
        if not f:
            return jsonify({"erro": f"Falta a foto: {key}."}), 400
        if f.mimetype not in ALLOWED_TYPES:
            return jsonify({"erro": f"Formato de imagem não suportado na foto {key}."}), 400
        photos[key] = (f.read(), f.mimetype)

    prefs = {k: (request.form.get(k) or "").strip()[:500] for k in
             ("estilo", "publico", "comprimento", "manutencao", "observacoes")}
    if not prefs["estilo"]:
        return jsonify({"erro": "Escolha o estilo que você quer transmitir."}), 400

    if DEMO_MODE:
        time.sleep(1.5)
        return jsonify({"demo": True, "resultado": DEMO_RESULT})

    from analysis import AnalysisError, analyze

    started = time.time()
    try:
        result = analyze(photos, prefs)
    except AnalysisError as e:
        app.logger.exception("Falha na análise")
        return jsonify({"erro": str(e)}), 502
    app.logger.info("Análise concluída em %.1fs", time.time() - started)
    return jsonify({"demo": False, "resultado": result})


@app.errorhandler(413)
def too_large(_):
    return jsonify({"erro": "As fotos são grandes demais. Tente novamente."}), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), debug=True)
