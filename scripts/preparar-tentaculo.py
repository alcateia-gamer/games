"""Conversão aprovada dos 140 quadros; PNG principal e GIF de alfa binário.

Execute com Pillow: --preparar ou --verificar. Mantém o original e usa o mesmo
modelo de paleta aprovado na prévia. Nenhum filtro modifica o desenho.
"""
import argparse
from collections import Counter
import gc
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, GifImagePlugin

spec = importlib.util.spec_from_file_location("previa_tentaculo", Path(__file__).with_name("prever-tentaculo.py"))
previa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previa)
FONTE = previa.FONTE
DESTINO = previa.PASTA / "derivados/tentaculo"
QUADROS = DESTINO / "quadros"
AGARRAO = DESTINO / "agarrao"


def png_rgba(nome):
    with Image.open(nome) as im:
        return im.convert("RGBA")


def gravar_gif(nomes, duracoes, loop, destino):
    # Paleta exata das cores recoloridas. GIF só admite alfa 0 ou 255.
    cores = set()
    for nome in nomes:
        with Image.open(nome) as im:
            cores.update(c[:3] for c in im.get_flattened_data() if c[3] >= 128)
    cores = sorted(cores)
    assert len(cores) <= 255, "Não reduzir a paleta automaticamente."
    indices = {c: i + 1 for i, c in enumerate(cores)}
    paleta = [0, 0, 0] + [v for cor in cores for v in cor]
    paleta += [0] * (768 - len(paleta))
    with destino.open("wb") as arquivo:
        for i, nome in enumerate(nomes):
            with Image.open(nome) as im:
                pixels = bytes(indices[p[:3]] if p[3] >= 128 else 0 for p in im.get_flattened_data())
                frame = Image.frombytes("P", im.size, pixels)
            frame.putpalette(paleta)
            if i == 0:
                header, _ = GifImagePlugin.getheader(frame, info={"loop": loop, "background": 0, "optimize": False})
                arquivo.write(b"".join(header))
            # Escrita explícita: não funde quadros iguais nem soma seus tempos.
            arquivo.write(b"".join(GifImagePlugin.getdata(frame,
                duration=duracoes[i], transparency=0, disposal=2)))
        arquivo.write(b";")


def criar_atlas(registros, nome):
    # Só recorta margens transparentes na textura de runtime. O JSON conserva
    # sourceSize e spriteSourceSize para reconstruir os 800×600 originais.
    paginas, atual = [], {"itens": [], "x": 2, "y": 2, "alturaLinha": 0, "largura": 0, "altura": 0}
    for item in sorted(registros, key=lambda r: (-(r["bbox"][3] - r["bbox"][1]), r["chave"])):
        l, t, r, b = item["bbox"]; w, h = r - l, b - t
        if atual["x"] + w + 2 > 4096:
            atual["x"] = 2; atual["y"] += atual["alturaLinha"] + 4; atual["alturaLinha"] = 0
        if atual["y"] + h + 2 > 4096:
            paginas.append(atual)
            atual = {"itens": [], "x": 2, "y": 2, "alturaLinha": 0, "largura": 0, "altura": 0}
        atual["itens"].append((item, atual["x"], atual["y"]))
        atual["largura"] = max(atual["largura"], atual["x"] + w + 2)
        atual["altura"] = max(atual["altura"], atual["y"] + h + 2)
        atual["x"] += w + 4; atual["alturaLinha"] = max(atual["alturaLinha"], h)
    paginas.append(atual)
    resultado = []
    for i, pagina in enumerate(paginas):
        arquivo = f"{nome}-atlas-{i + 1}"
        imagem = Image.new("RGBA", (pagina["largura"], pagina["altura"]))
        frames = {}
        for item, x, y in pagina["itens"]:
            l, t, r, b = item["bbox"]; w, h = r - l, b - t
            with Image.open(item["arquivo"]) as frame:
                imagem.paste(frame.crop((l, t, r, b)), (x, y))
            frames[item["chave"]] = {"frame": {"x": x, "y": y, "w": w, "h": h},
                "rotated": False, "trimmed": True,
                "spriteSourceSize": {"x": l, "y": t, "w": w, "h": h},
                "sourceSize": {"w": 800, "h": 600}}
        imagem.save(DESTINO / f"{arquivo}.png", optimize=True)
        meta = {"frames": frames, "meta": {"image": f"{arquivo}.png", "format": "RGBA8888",
            "size": {"w": imagem.width, "h": imagem.height}, "scale": "1"}}
        (DESTINO / f"{arquivo}.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n")
        resultado.append({"imagem": f"{arquivo}.png", "dados": f"{arquivo}.json", "quadros": sorted(frames)})
        imagem.close()
    return resultado


def preparar():
    for pasta in [DESTINO, QUADROS, AGARRAO]:
        pasta.mkdir(exist_ok=True)
    cores, duracoes = Counter(), []
    with Image.open(FONTE) as gif:
        assert gif.n_frames == 140 and gif.size == (800, 600)
        loop = gif.info.get("loop", 0)
        for i in range(gif.n_frames):
            gif.seek(i); cores.update(gif.convert("RGB").get_flattened_data()); duracoes.append(gif.info["duration"])
    tabela, bordas, fundos, solidos = previa.modelo(cores)
    erro_por_cor = {tuple(c["corOriginal"]): c["erroModeloRGB"] for c in bordas}
    registros, relatorio = [], []
    with Image.open(FONTE) as gif:
        for i in range(140):
            gif.seek(i); original = gif.convert("RGB")
            frame = previa.processar_amostra(original, tabela, True)
            nome = QUADROS / f"quadro-{i + 1:03d}.png"
            frame.save(nome, optimize=True)
            alfas = Counter(p[3] for p in frame.get_flattened_data())
            frequencias = Counter(original.get_flattened_data())
            opacos_esperados = sum(frequencias[c] for c in solidos)
            assert alfas[255] >= opacos_esperados, "Transparência indevida em pixels sólidos."
            bbox = frame.getbbox(); assert bbox is not None
            registros.append({"chave": f"tentaculo-{i:03d}", "arquivo": str(nome), "bbox": bbox})
            relatorio.append({"quadro": i + 1, "bbox": bbox,
                "pixelsSolidosPreservados": opacos_esperados,
                "pixelsBordaAlfaParcial": sum(n for a, n in alfas.items() if 0 < a < 255),
                "pixelsBordaEstimativaIncertos": sum(n for c, n in frequencias.items() if erro_por_cor.get(c, 0) > 10),
                "pixelsPerdidosNoGifPorAlfaBinario": sum(n for a, n in alfas.items() if 0 < a < 128),
                "falhaPixelsSolidos": False})
            if (i + 1) % 20 == 0:
                print(f"PNG: {i + 1}/140 quadros", flush=True)
    # Folha integral de entrega, não carregada diretamente pela GPU do jogo.
    folha = Image.new("RGBA", (8000, 8400))
    for i, item in enumerate(registros):
        with Image.open(item["arquivo"]) as frame:
            folha.paste(frame, (i % 10 * 800, i // 10 * 600))
    folha.save(DESTINO / "tentaculo-vermelho-quadros.png", optimize=True)
    folha.close(); del folha; gc.collect()
    atlas = criar_atlas(registros, "tentaculo")
    nomes = [r["arquivo"] for r in registros]
    gravar_gif(nomes, duracoes, loop, DESTINO / "tentaculo-vermelho-transparente.gif")
    print("GIF: 140 quadros explícitos; atlas principal pronto", flush=True)

    # Cópia adicional: duas curvaturas do quadro 26, espelhamento e deslocamentos
    # inteiros. Sem redesenhar, interpolar, suavizar ou deformar a fonte.
    curva = png_rgba(QUADROS / "quadro-026.png")
    espelho = curva.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    deslocamentos = [-36, -30, -24, -18, -12, -6, 0, 4, 2, 0, 2, 4,
        4, 0, -6, -12, -18, -24, -30, -36]
    registros_grab = []
    for i, deslocamento in enumerate(deslocamentos):
        frame = Image.new("RGBA", (800, 600))
        frame.alpha_composite(curva, (deslocamento, 0))
        frame.alpha_composite(espelho, (-deslocamento, 0))
        nome = AGARRAO / f"quadro-{i + 1:03d}.png"; frame.save(nome, optimize=True)
        registros_grab.append({"chave": f"agarrao-{i:03d}", "arquivo": str(nome), "bbox": frame.getbbox()})
    folha = Image.new("RGBA", (4000, 2400))
    for i, item in enumerate(registros_grab):
        with Image.open(item["arquivo"]) as frame:
            folha.paste(frame, (i % 5 * 800, i // 5 * 600))
    folha.save(DESTINO / "tentaculo-agarrao-quadros.png", optimize=True); folha.close()
    atlas_grab = criar_atlas(registros_grab, "agarrao")
    gravar_gif([r["arquivo"] for r in registros_grab], [40] * len(registros_grab), 0,
        DESTINO / "tentaculo-agarrao.gif")
    manifesto = {"fonte": FONTE.name, "sha256Original": hashlib.sha256(FONTE.read_bytes()).hexdigest(),
        "larguraFrame": 800, "alturaFrame": 600, "quadros": 140,
        "duracoesMs": duracoes, "duracaoMs": sum(duracoes), "loop": loop,
        "alfaGif": "binário, corte 128; PNG conserva o alfa parcial aprovado",
        "coresFundo": len(fundos), "coresSolidas": len(solidos), "bordasEstimadas": bordas,
        "paginasAtlas": atlas, "paginasAgarrão": atlas_grab,
        "agarrao": {"quadros": len(deslocamentos), "frameMs": 40,
            "fechar": [0, 7], "sustentar": [8, 11], "abrir": [12, 19],
            "origem": "cópias do quadro 26, espelhadas, deslocadas em pixels inteiros"}}
    (DESTINO / "tentaculo.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n")
    (DESTINO / "relatorio-quadros.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=2) + "\n")
    linhas = ["# Relatório do tentáculo", "", "140 quadros, 800 × 600, 40 ms cada, loop original.", "",
        "Não houve perda detectada de pixels sólidos do tentáculo. As bordas da fonte já estavam misturadas ao fundo; seu alfa é estimado por um modelo fixo aprovado.",
        "PNG é a entrega principal. O GIF usa alfa binário e pode perder cobertura sutil nas bordas. A tabela informa os pixels afetados em cada quadro.", "",
        "| Quadro | Sólidos preservados | Borda com alfa parcial | Borda estimada incerta | Borda descartada no GIF |", "|---:|---:|---:|---:|---:|"]
    linhas += [f"| {r['quadro']} | {r['pixelsSolidosPreservados']} | {r['pixelsBordaAlfaParcial']} | {r['pixelsBordaEstimativaIncertos']} | {r['pixelsPerdidosNoGifPorAlfaBinario']} |" for r in relatorio]
    (DESTINO / "relatorio-quadros.md").write_text("\n".join(linhas) + "\n")
    print(f"Atlas: {len(atlas)} página(s); agarrão separado: {len(deslocamentos)} quadros", flush=True)


def verificar(inicio=0, fim=140):
    assert 0 <= inicio < fim <= 140
    print(f"Conferindo quadros {inicio + 1}–{fim}, fonte e arquivos exportados...", flush=True)
    meta = json.loads((DESTINO / "tentaculo.json").read_text())
    assert hashlib.sha256(FONTE.read_bytes()).hexdigest() == meta["sha256Original"]
    cores = Counter()
    with Image.open(FONTE) as gif:
        for i in range(140):
            gif.seek(i); cores.update(gif.convert("RGB").get_flattened_data())
    tabela, _, _, _ = previa.modelo(cores)
    with Image.open(FONTE) as fonte, Image.open(DESTINO / "tentaculo-vermelho-transparente.gif") as gif:
        assert gif.n_frames == 140 and gif.size == (800, 600) and gif.info["loop"] == fonte.info["loop"]
        for i in range(inicio, fim):
            fonte.seek(i); gif.seek(i)
            assert gif.info["duration"] == fonte.info["duration"] == meta["duracoesMs"][i]
            esperado = previa.processar_amostra(fonte, tabela, True)
            atual = png_rgba(QUADROS / f"quadro-{i + 1:03d}.png")
            assert esperado.tobytes() == atual.tobytes(), (i, "PNG não corresponde ao modelo aprovado")
            for png, pixel_gif in zip(atual.get_flattened_data(), gif.convert("RGBA").get_flattened_data()):
                assert pixel_gif == ((*png[:3], 255) if png[3] >= 128 else (0, 0, 0, 0)), (i, "GIF alterou cores ou máscara")
            if (i + 1) % 20 == 0:
                print(f"Verificação PNG/GIF: {i + 1}/140", flush=True)
    for pagina in [*meta["paginasAtlas"], *meta["paginasAgarrão"]]:
        dados = json.loads((DESTINO / pagina["dados"]).read_text())
        with Image.open(DESTINO / pagina["imagem"]) as atlas:
            assert max(atlas.size) <= 4096
            for chave, frame in dados["frames"].items():
                indice = int(chave.split("-")[-1])
                if chave.startswith("agarrao") and fim != 140:
                    continue
                if chave.startswith("tentaculo") and not inicio <= indice < fim:
                    continue
                caixa, origem = frame["frame"], frame["spriteSourceSize"]
                recuperado = Image.new("RGBA", (800, 600))
                recuperado.paste(atlas.crop((caixa["x"], caixa["y"], caixa["x"] + caixa["w"], caixa["y"] + caixa["h"])),
                    (origem["x"], origem["y"]))
                indice = int(chave.split("-")[-1]) + 1
                arquivo = (AGARRAO if chave.startswith("agarrao") else QUADROS) / f"quadro-{indice:03d}.png"
                # RGB invisível não afeta a arte; o atlas só recorta margem com alfa zero.
                referencia = png_rgba(arquivo)
                assert recuperado.tobytes() == referencia.tobytes(), chave
    with Image.open(DESTINO / "tentaculo-vermelho-quadros.png") as folha:
        for i in range(inicio, fim):
            recorte = folha.crop((i % 10 * 800, i // 10 * 600, i % 10 * 800 + 800, i // 10 * 600 + 600))
            assert recorte.tobytes() == png_rgba(QUADROS / f"quadro-{i + 1:03d}.png").tobytes()
    with Image.open(DESTINO / "tentaculo-agarrao.gif") as gif, Image.open(DESTINO / "tentaculo-agarrao-quadros.png") as folha:
        assert gif.n_frames == 20 and gif.size == (800, 600) and gif.info["loop"] == 0
        for i in range(20):
            gif.seek(i); assert gif.info["duration"] == 40
            png = png_rgba(AGARRAO / f"quadro-{i + 1:03d}.png")
            recorte = folha.crop((i % 5 * 800, i // 5 * 600, i % 5 * 800 + 800, i // 5 * 600 + 600))
            assert recorte.tobytes() == png.tobytes()
            for original, convertido in zip(png.get_flattened_data(), gif.convert("RGBA").get_flattened_data()):
                assert convertido == ((*original[:3], 255) if original[3] >= 128 else (0, 0, 0, 0))
    print(f"Verificados PNG/GIF, folha e atlas dos quadros {inicio + 1}–{fim}; 20 extras conferidos. Original preservado.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    grupo = parser.add_mutually_exclusive_group(required=True)
    grupo.add_argument("--preparar", action="store_true"); grupo.add_argument("--verificar", action="store_true")
    parser.add_argument("--inicio", type=int, default=0, help="Índice inicial para verificação em lotes (0–139).")
    parser.add_argument("--fim", type=int, default=140, help="Limite exclusivo do lote de verificação.")
    args = parser.parse_args()
    if args.preparar:
        preparar()
    else:
        verificar(args.inicio, args.fim)
