"""Monta comparativos de capturas reais; não lê nem modifica os assets do jogo.

Requer Pillow. Capture antes com tests/armas-encaixe.browser.mjs.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw


def gerar(capturas, destino):
    destino.mkdir(parents=True, exist_ok=True)
    armas = ["rifle-teste", "espada-teste", "florete-teste", "dourada-teste"]

    def celula(nome):
        with Image.open(capturas / nome) as im:
            # Região fixa do canvas: conserva os pixels, sem redimensionamento.
            return im.convert("RGB").crop((340, 150, 680, 570))

    def grade(nome, itens, colunas=2):
        folha = Image.new("RGB", (340 * colunas, 450 * ((len(itens) + colunas - 1) // colunas)), (27, 34, 46))
        d = ImageDraw.Draw(folha)
        for i, (arquivo, label) in enumerate(itens):
            x, y = i % colunas * 340, i // colunas * 450
            if (capturas / arquivo).exists():
                folha.paste(celula(arquivo), (x, y + 30))
            else:
                label += " (sem captura)"
            d.text((x + 8, y + 8), label, fill="white")
        folha.save(destino / nome)

    grade("antes-depois.png", [(f"{v}-{a}-idle-direita.png", f"{v} / {a}")
                              for a in armas[:3] for v in ["antes", "depois"]])
    grade("ataques.png", [(f"depois-{a}-{t}.png", a + " / " + t)
                          for a in armas for t in ["ataque", "ataque-esquerda"]])
    grade("mira-cima.png", [(f"depois-{a}-idle-cima.png", a + " / cima (arma atras)") for a in armas])
    grade("rotacao.png", [(f"rotacao-{n}.png", f"Rotacao: {n or 'continua'}") for n in [0, 8, 16]], 3)
    for a in armas:
        itens = [(f"depois-{a}-walk-{i:02}.png", f"{a} / walk {i}") for i in range(16)]
        grade(a + "-caminhada.png", itens, 4)
        frames = [celula(n) for n, _ in itens]
        frames[0].save(destino / (a + "-caminhada.gif"), save_all=True, append_images=frames[1:],
                       duration=[80, 80, 90] * 5 + [80], loop=0, optimize=False)
    print(f"Prévias exportadas para {destino}; fontes do jogo não foram modificadas.")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--capturas", type=Path, default=Path("/tmp/encaixe-armas/browser"))
    p.add_argument("--destino", type=Path, default=Path(__file__).resolve().parents[1] / "docs/previas-armas")
    args = p.parse_args()
    gerar(args.capturas, args.destino)
