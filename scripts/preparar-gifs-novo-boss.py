"""Empacota quadros RGBA sem redimensionar nem alterar os GIFs fornecidos.

Requer Pillow. Execute com --verificar para conferir as folhas existentes.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[1]
PASTA = RAIZ / "assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test"
DESTINO = PASTA / "derivados"
FONTES = ("escudo-energia.gif", "ataque-explosão.gif")


def preparar(verificar=False):
    manifest = {}
    if not verificar:
        DESTINO.mkdir(exist_ok=True)
    for nome in FONTES:
        fonte = PASTA / nome
        with Image.open(fonte) as gif:
            largura, altura = gif.size
            quadros, duracoes = [], []
            for indice in range(gif.n_frames):
                gif.seek(indice)
                quadros.append(gif.convert("RGBA").copy())
                duracoes.append(gif.info["duration"])
        colunas = 3
        linhas = (len(quadros) + colunas - 1) // colunas
        folha = Image.new("RGBA", (largura * colunas, altura * linhas))
        for indice, quadro in enumerate(quadros):
            folha.paste(quadro, ((indice % colunas) * largura, (indice // colunas) * altura))
        png = fonte.stem.replace("ã", "a") + "-quadros.png"
        manifest[nome] = {
            "sha256": hashlib.sha256(fonte.read_bytes()).hexdigest(),
            "folha": png, "larguraFrame": largura, "alturaFrame": altura,
            "quadros": len(quadros), "duracoesMs": duracoes, "colunas": colunas,
        }
        if verificar:
            with Image.open(DESTINO / png) as atual:
                assert atual.size == folha.size and atual.convert("RGBA").tobytes() == folha.tobytes(), png
        else:
            folha.save(DESTINO / png, optimize=True)
    arquivo = DESTINO / "gifs-originais.json"
    if verificar:
        assert json.loads(arquivo.read_text()) == manifest, "Manifesto desatualizado"
    else:
        arquivo.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print("GIFs originais e todos os quadros conferidos." if verificar else "Duas folhas criadas; GIFs originais preservados.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verificar", action="store_true")
    preparar(parser.parse_args().verificar)
