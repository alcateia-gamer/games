"""Extrai o GIF original, sem alterar pixels, resolução, transparência ou tempos.

Requer Pillow. Execute: python scripts/preparar-portal-boss.py
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parents[1]
ORIGINAL = RAIZ / "Tilesets/mechanics/portal.gif"
SAIDA = RAIZ / "assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/portal"

def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    with Image.open(ORIGINAL) as gif:
        largura, altura = gif.size
        folha = Image.new("RGBA", (largura * gif.n_frames, altura))
        duracoes = []
        for i in range(gif.n_frames):
            gif.seek(i)
            quadro = gif.convert("RGBA")
            # paste sem máscara copia inclusive os pixels transparentes, sem recomposição.
            folha.paste(quadro, (i * largura, 0))
            duracoes.append(gif.info["duration"])
        folha.save(SAIDA / "portal-quadros.png")
        (SAIDA / "portal.json").write_text(json.dumps({
            "original": str(ORIGINAL.relative_to(RAIZ)),
            "sha256": hashlib.sha256(ORIGINAL.read_bytes()).hexdigest(),
            "larguraFrame": largura, "alturaFrame": altura,
            "quadros": gif.n_frames, "duracoesMs": duracoes,
            "loop": gif.info.get("loop", 0),
        }, indent=2) + "\n")

if __name__ == "__main__":
    main()
