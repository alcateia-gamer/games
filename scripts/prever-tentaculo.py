"""Prévia conservadora; não converte a sequência integral antes da avaliação.

Pillow: segmentação por famílias da paleta, com modelo fixo de mistura de borda.
Nenhum redesenho, filtro espacial, deformação ou mudança da resolução da fonte.
"""
from collections import Counter
from pathlib import Path
import hashlib
import json
import math

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parents[1]
PASTA = RAIZ / "assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal"
FONTE = PASTA / "tentáculo.gif"
DESTINO = PASTA / "derivados/tentaculo-previa"
AMOSTRAS = (0, 10, 25, 45, 110)


def recolorir(rgb):
    # Permutação e ganho por canal: mantém variações originais em cada tom.
    # Âncora do corpo (84,44,137) -> vermelho da boss (209,31,18).
    r, g, b = rgb
    return (min(255, round(b * 209 / 137)),
        min(255, round(r * 31 / 84)), min(255, round(g * 18 / 44)))


def modelo(cores):
    # Famílias, não uma única cor. O fundo contém dezenas de tons de textura.
    fundo = [c for c in cores if c[1] - c[0] >= 45 and c[2] - c[1] <= -5]
    solidos = [c for c in cores if c[2] - c[1] >= 60 and c[1] <= 60]
    tabela, bordas = {}, []
    for cor in cores:
        if cor in fundo:
            tabela[cor] = (0, 0, 0, 0)
            continue
        if cor in solidos:
            tabela[cor] = (*cor, 255)
            continue
        melhor = None
        for bg in fundo:
            for fg in solidos:
                vetor = tuple(fg[k] - bg[k] for k in range(3))
                alfa = max(0, min(1, sum((cor[k] - bg[k]) * vetor[k] for k in range(3)) /
                    sum(v * v for v in vetor)))
                erro = math.sqrt(sum((cor[k] - (bg[k] + alfa * vetor[k])) ** 2 for k in range(3)))
                if melhor is None or erro < melhor[0]:
                    melhor = (erro, alfa, fg)
        erro, alfa, fg = melhor
        # Não apaga a família de borda por arredondamento; preserva cobertura mínima.
        tabela[cor] = (*fg, max(1, round(alfa * 255)))
        bordas.append({"corOriginal": cor, "alfa": tabela[cor][3],
            "erroModeloRGB": round(erro, 3), "roxoEstimado": fg})
    return tabela, bordas, fundo, solidos


def processar_amostra(imagem, tabela, vermelho):
    original = imagem.convert("RGB")
    dados = []
    for p in original.get_flattened_data():
        r, g, b, alfa = tabela[p]
        dados.append((*(recolorir((r, g, b)) if vermelho and alfa else (r, g, b)), alfa))
    saida = Image.new("RGBA", imagem.size)
    saida.putdata(dados)
    return saida


def xadrez(tamanho, claro=False):
    cores = ((226, 230, 236), (251, 252, 253)) if claro else ((35, 42, 54), (53, 62, 78))
    fundo = Image.new("RGBA", tamanho, (*cores[0], 255))
    draw = ImageDraw.Draw(fundo)
    for y in range(0, tamanho[1], 16):
        for x in range(0, tamanho[0], 16):
            if (x // 16 + y // 16) % 2:
                draw.rectangle((x, y, x + 15, y + 15), fill=(*cores[1], 255))
    return fundo


def executar():
    DESTINO.mkdir(exist_ok=True)
    hash_antes = hashlib.sha256(FONTE.read_bytes()).hexdigest()
    cores, duracoes, amostras = Counter(), [], {}
    with Image.open(FONTE) as gif:
        tamanho, quantidade, loop = gif.size, gif.n_frames, gif.info.get("loop")
        for indice in range(quantidade):
            gif.seek(indice)
            imagem = gif.convert("RGB")
            cores.update(imagem.get_flattened_data())
            duracoes.append(gif.info["duration"])
            if indice in AMOSTRAS:
                amostras[indice] = imagem.copy()
    tabela, bordas, fundos, solidos = modelo(cores)
    w, h = tamanho
    painel = Image.new("RGB", (w * 3, (h + 30) * len(amostras)), (25, 28, 38))
    draw = ImageDraw.Draw(painel)
    relatorio = {"fonte": FONTE.name, "sha256Original": hash_antes,
        "dimensoes": tamanho, "quadrosOriginais": quantidade,
        "quadrosProcessadosNestaPrevia": [i + 1 for i in amostras],
        "duracoesOriginaisMs": duracoes, "loop": loop,
        "coresFundo": len(fundos), "coresSolidasTentaculo": len(solidos),
        "coresBordaMescladas": bordas, "amostras": [],
        "limites": ["Bordas mescladas na fonte exigem estimativa de alfa; não há recorte original sem fundo.",
            "PNG preserva alfa parcial. GIF tem transparência binária e não reproduz exatamente esse alfa.",
            "Só cinco amostras processadas: aguarda avaliação antes de converter os 140 quadros."]}
    for linha, (indice, original) in enumerate(amostras.items()):
        roxo = processar_amostra(original, tabela, False)
        vermelho = processar_amostra(original, tabela, True)
        roxo.save(DESTINO / f"quadro-{indice + 1:03d}-roxo.png")
        vermelho.save(DESTINO / f"quadro-{indice + 1:03d}-vermelho.png")
        contagem = Counter(p[3] for p in vermelho.get_flattened_data())
        relatorio["amostras"].append({"quadro": indice + 1, "pixelsOpacos": contagem[255],
            "pixelsTransparentes": contagem[0], "pixelsBordaComAlfaParcial":
                sum(n for alfa, n in contagem.items() if 0 < alfa < 255)})
        for col, (imagem, titulo) in enumerate([(original, "ORIGINAL"),
                (Image.alpha_composite(xadrez(tamanho), vermelho), "VERMELHO / ESCURO"),
                (Image.alpha_composite(xadrez(tamanho, True), vermelho), "VERMELHO / CLARO")]):
            x, y = col * w, linha * (h + 30)
            draw.text((x + 8, y + 8), f"Quadro {indice + 1}/140 — {titulo}", fill="white")
            painel.paste(imagem.convert("RGB"), (x, y + 30))
    painel.save(DESTINO / "comparacao.png")
    assert hashlib.sha256(FONTE.read_bytes()).hexdigest() == hash_antes
    (DESTINO / "relatorio-previa.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=2) + "\n")
    print(f"Prévia de {len(amostras)} quadros. {len(fundos)} cores de fundo, {len(solidos)} tons sólidos e {len(bordas)} tons de borda estimados. Original preservado.")


if __name__ == "__main__":
    executar()
