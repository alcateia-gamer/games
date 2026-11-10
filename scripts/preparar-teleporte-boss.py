"""Adapta a energia do GIF sem redesenhar a boss. Requer Pillow.

Primeiro execute --previa PASTA e inspecione o resultado; --exportar gera os
recursos definitivos. --verificar confere pixels, tempos e fontes preservadas.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, GifImagePlugin

RAIZ = Path(__file__).resolve().parents[1]
PASTA = RAIZ / "assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal"
DESTINO = PASTA / "derivados/teleporte"
TAMANHO = (512, 640)
POSICAO = (112, 200)
PIVO = (256, 344)


def fontes():
    gif = Image.open(PASTA / "teleporte(base).gif")
    frames, tempos = [], []
    for i in range(gif.n_frames):
        gif.seek(i)
        frames.append(gif.convert("RGBA").copy())
        tempos.append(gif.info.get("duration", 0))
    assert len(frames) == 26 and gif.size == (400, 400)
    idle = Image.open(PASTA / "boss-idle.png").convert("RGBA").crop((0, 0, 288, 288))
    return frames, tempos, idle


def energia(frame, indice):
    """Extrai apenas anéis/feixe; exclui a região do personagem original.

    O fundo é o azul dominante. Anéis são neutros e o feixe é branco. A
    exclusão espacial retira inclusive a silhueta preta da pessoa nos 9/22.
    Não aplica remoção de preto à imagem da boss.
    """
    fundo = Counter(frame.get_flattened_data()).most_common(1)[0][0]
    saida = Image.new("RGBA", TAMANHO)
    d = ImageDraw.Draw(saida)
    centro_x = 106 if indice < 17 else 282
    for y in range(400):
        for x in range(400):
            r, g, b, a = frame.getpixel((x, y))
            if not a or (r, g, b, a) == fundo:
                continue
            if max(r, g, b) - min(r, g, b) > 30:
                continue
            # Sem aproveitamento de qualquer pixel do personagem central.
            if centro_x - 23 <= x <= centro_x + 22 and 265 <= y <= 342:
                # Após a dissolução, somente o feixe branco continua neste local.
                if indice < 10 or indice >= 22 or min(r, g, b) < 205:
                    continue
            if 10 <= indice <= 21 and min(r, g, b) < 205:
                continue
            luminancia = (r + g + b) / 765
            cor = (round(30 + 210 * luminancia), round(150 + 101 * luminancia), 255, 255)
            # Anéis recebem escala inteira 3×, proporcional e sem interpolação.
            # O feixe mantém largura 3× e altura nativa para caber acima do corpo.
            feixe = 10 <= indice <= 21
            px = PIVO[0] + (x - centro_x) * 3
            py = (470 if feixe else 360) + (y - 340) * (1 if feixe else 3)
            d.rectangle((px, py, px + 2, py + (0 if feixe else 2)), fill=cor)
    return saida


def corpo(idle, progresso):
    """Recolore pixels originais e dispersa blocos 3×3, sem reamostrar arte."""
    saida = Image.new("RGBA", TAMANHO)
    mistura = min(1, max(0, (progresso - 0.08) / 0.46))
    mistura = mistura * mistura * (3 - 2 * mistura)
    dispersao = min(1, max(0, (progresso - 0.45) / 0.39))
    for y in range(288):
        for x in range(288):
            r, g, b, a = idle.getpixel((x, y))
            if not a:
                continue
            brilho = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
            alvo = (round(50 + 200 * brilho), round(170 + 85 * brilho), 255)
            cor = tuple(round(v * (1 - mistura) + c * mistura) for v, c in zip((r, g, b), alvo))
            # Hash espacial estável: mesmas peças na saída e na formação.
            h = ((x // 3 * 73856093) ^ (y // 3 * 19349663)) % 997 / 997
            desprendido = dispersao > h
            dx = dy = 0
            if desprendido:
                idade = (dispersao - h) / max(0.001, 1 - h)
                if idade > 0.28 or dispersao >= 1:
                    continue
                dx = round((PIVO[0] - POSICAO[0] - x) * idade * 1.6)
                dy = -round(idade * 180)
            saida.putpixel((POSICAO[0] + x + dx, POSICAO[1] + y + dy), (*cor, a))
    return saida


def renderizar(tipo, indice, frames, idle):
    if tipo == "saida":
        if indice == 17:
            return Image.new("RGBA", TAMANHO)
        p, fonte = indice / 16, indice
    else:
        p, fonte = 1 - indice / 8, 17 + indice
    resultado = corpo(idle, p)
    resultado.alpha_composite(energia(frames[fonte], fonte))
    return resultado


def gravar_gif(frames, duracoes, caminho):
    # PNG é o principal. GIF usa alfa binário e paleta local sem suavização.
    with caminho.open("wb") as arquivo:
        for i, rgba in enumerate(frames):
            rgb = rgba.convert("RGB").quantize(colors=255, dither=Image.Dither.NONE)
            paleta = rgb.getpalette()[:765] + [0, 0, 0]
            rgb.putpalette(paleta)
            rgb.paste(255, mask=rgba.getchannel("A").point(lambda a: 255 if a < 128 else 0))
            if i == 0:
                header, _ = GifImagePlugin.getheader(rgb, info={"loop": 0, "background": 255})
                arquivo.write(b"".join(header))
            arquivo.write(b"".join(GifImagePlugin.getdata(rgb, duration=duracoes[i],
                transparency=255, disposal=2, include_color_table=True)))
        arquivo.write(b";")


def tempos_tipo(tipo, originais):
    # Elimina holds de 1 s e normaliza quadros sem duração a 20 ms.
    return ([60] + [d or 20 for d in originais[1:17]] + [40]) if tipo == "saida" else \
        [d or 20 for d in originais[17:25]] + [80]


def previa(destino):
    destino.mkdir(parents=True, exist_ok=True)
    frames, tempos, idle = fontes()
    amostras = {"saida": [0, 3, 6, 9, 12, 15, 17], "entrada": [0, 2, 4, 6, 8]}
    contato = Image.new("RGB", (7 * 256, 2 * 344), (36, 42, 51))
    d = ImageDraw.Draw(contato)
    for linha, (tipo, indices) in enumerate(amostras.items()):
        imagens = []
        for coluna, indice in enumerate(indices):
            im = renderizar(tipo, indice, frames, idle)
            im.save(destino / f"{tipo}-{indice:03}.png")
            imagens.append(im)
            mini = im.resize((256, 320), Image.Resampling.NEAREST)
            contato.paste(mini, (coluna * 256, linha * 344 + 24), mini)
            d.text((coluna * 256 + 8, linha * 344 + 5), f"{tipo} {indice}", fill="white")
        gravar_gif(imagens, [130] * len(imagens), destino / f"previa-{tipo}.gif")
    contato.save(destino / "previa-transformacao.png")
    print(f"Prévia representativa: {destino}")


def exportar(verificar=False):
    frames, tempos, idle = fontes()
    manifesto = {"resolucaoFonte": [400, 400], "quadrosFonte": 26,
        "duracoesFonteMs": tempos, "resolucaoSaida": list(TAMANHO), "pivo": list(PIVO),
        "fontes": {nome: hashlib.sha256((PASTA / nome).read_bytes()).hexdigest()
                   for nome in ["teleporte(base).gif", "boss-idle.png", "boss-death.webp"]},
        "notas": ["Corpo original 288×288 sem redimensionamento ou redesenho.",
            "Fundo sólido azul removido apenas da energia de referência.",
            "Anéis 3× nearest; feixe reposicionado acima do corpo, sem esticar o GIF inteiro.",
            "Saída: fonte 0–16 e quadro transparente extra. Entrada: fonte 17–25 em ordem original.",
            "Pausas de 1000 ms substituídas por 60/80 ms; quadros 0 ms normalizados a 20 ms.",
            "No jogo, relógios visuais são ajustados às janelas existentes de 250 ms por etapa; física preservada.",
            "GIF: alfa binário e até 255 cores locais; PNG RGBA é a versão principal."]}
    if not verificar:
        DESTINO.mkdir(parents=True, exist_ok=True)
    for tipo, quantidade in [("saida", 18), ("entrada", 9)]:
        imagens = [renderizar(tipo, i, frames, idle) for i in range(quantidade)]
        duracoes = tempos_tipo(tipo, tempos)
        pasta = DESTINO / tipo
        if not verificar:
            pasta.mkdir(exist_ok=True)
        folha = Image.new("RGBA", (512 * 4, 640 * math.ceil(quantidade / 4)))
        for i, im in enumerate(imagens):
            caminho = pasta / f"quadro-{i:03}.png"
            if verificar:
                assert Image.open(caminho).convert("RGBA").tobytes() == im.tobytes(), caminho
            else:
                im.save(caminho)
            folha.paste(im, ((i % 4) * 512, (i // 4) * 640))
            assert im.getpixel((0, 0))[3] == 0 and im.getpixel((511, 639))[3] == 0
        png = DESTINO / f"teleporte-{tipo}.png"
        gif = DESTINO / f"teleporte-{tipo}.gif"
        if verificar:
            assert Image.open(png).convert("RGBA").tobytes() == folha.tobytes()
        else:
            folha.save(png, optimize=True)
            gravar_gif(imagens, duracoes, gif)
        with Image.open(gif) as atual:
            assert atual.n_frames == quantidade
            for i, ms in enumerate(duracoes):
                atual.seek(i)
                assert atual.info["duration"] == ms and atual.convert("RGBA").getpixel((0, 0))[3] == 0
        manifesto[tipo] = {"quadros": quantidade, "duracoesMs": duracoes, "duracaoMs": sum(duracoes)}
    morte = Image.open(PASTA / "boss-death.webp").convert("RGBA")
    if verificar:
        assert Image.open(DESTINO / "boss-morte.png").tobytes() == morte.tobytes()
        assert json.loads((DESTINO / "manifesto.json").read_text()) == manifesto
    else:
        morte.save(DESTINO / "boss-morte.png")
        (DESTINO / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n")
    print("Pixels, GIFs, tempos, transparência e fontes conferidos." if verificar else
          f"Animações exportadas em {DESTINO}; originais preservados.")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    modo = p.add_mutually_exclusive_group(required=True)
    modo.add_argument("--previa", type=Path)
    modo.add_argument("--exportar", action="store_true")
    modo.add_argument("--verificar", action="store_true")
    args = p.parse_args()
    if args.previa:
        previa(args.previa)
    else:
        exportar(args.verificar)
