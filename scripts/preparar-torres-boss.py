"""Extrai os WebP das torres em spritesheets RGBA, sem dependências Python externas.

Execute com python3 scripts/preparar-torres-boss.py (requer libwebp do sistema).
Preserva composição, transparência, descarte e duração dos quadros originais.
"""
import ctypes
import ctypes.util
import json
from pathlib import Path
import struct
import zlib

BASE = Path(__file__).resolve().parents[1] / "assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test"
SAIDA = BASE / "derivados/torres"
LIB = ctypes.CDLL(ctypes.util.find_library("webp"))
LIB.WebPDecodeRGBA.argtypes = [ctypes.c_void_p, ctypes.c_size_t,
                              ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int)]
LIB.WebPDecodeRGBA.restype = ctypes.c_void_p
LIB.WebPFree.argtypes = [ctypes.c_void_p]


def decodificar(dados):
    largura, altura = ctypes.c_int(), ctypes.c_int()
    ponteiro = LIB.WebPDecodeRGBA(dados, len(dados), ctypes.byref(largura), ctypes.byref(altura))
    if not ponteiro:
        raise ValueError("WebP inválido")
    try:
        return largura.value, altura.value, ctypes.string_at(ponteiro, largura.value * altura.value * 4)
    finally:
        LIB.WebPFree(ponteiro)


def blocos(dados, inicio=12):
    while inicio + 8 <= len(dados):
        tamanho = int.from_bytes(dados[inicio + 4:inicio + 8], "little")
        yield dados[inicio:inicio + 4], dados[inicio + 8:inicio + 8 + tamanho]
        inicio += 8 + tamanho + tamanho % 2


def quadros(dados):
    partes = list(blocos(dados))
    animados = [conteudo for tipo, conteudo in partes if tipo == b"ANMF"]
    if not animados:
        largura, altura, pixels = decodificar(dados)
        return largura, altura, [(pixels, 100)]
    cabecalho = next(conteudo for tipo, conteudo in partes if tipo == b"VP8X")
    largura = 1 + int.from_bytes(cabecalho[4:7], "little")
    altura = 1 + int.from_bytes(cabecalho[7:10], "little")
    canvas = bytearray(largura * altura * 4)
    resultado = []
    for quadro in animados:
        x, y, w, h, duracao = [int.from_bytes(quadro[i:i + 3], "little") for i in range(0, 15, 3)]
        x *= 2
        y *= 2
        w += 1
        h += 1
        flags = quadro[15]
        payload = b"WEBP" + quadro[16:]
        fw, fh, pixels = decodificar(b"RIFF" + struct.pack("<I", len(payload)) + payload)
        assert (fw, fh) == (w, h)
        for linha in range(h):
            for coluna in range(w):
                origem = (linha * w + coluna) * 4
                destino = ((y + linha) * largura + x + coluna) * 4
                rgba = pixels[origem:origem + 4]
                if flags & 2 or rgba[3] == 255:
                    canvas[destino:destino + 4] = rgba
                elif rgba[3]:
                    fundo = canvas[destino:destino + 4]
                    alpha = rgba[3] * 255 + fundo[3] * (255 - rgba[3])
                    for canal in range(3):
                        canvas[destino + canal] = (rgba[canal] * rgba[3] * 255 +
                            fundo[canal] * fundo[3] * (255 - rgba[3]) + alpha // 2) // alpha
                    canvas[destino + 3] = (alpha + 127) // 255
        resultado.append((bytes(canvas), duracao))
        if flags & 1:
            for linha in range(h):
                inicio = ((y + linha) * largura + x) * 4
                canvas[inicio:inicio + w * 4] = bytes(w * 4)
    return largura, altura, resultado


def salvar_png(caminho, largura, altura, pixels):
    def bloco(tipo, conteudo):
        return struct.pack(">I", len(conteudo)) + tipo + conteudo + struct.pack(">I", zlib.crc32(tipo + conteudo))
    linhas = b"".join(b"\0" + pixels[y * largura * 4:(y + 1) * largura * 4] for y in range(altura))
    caminho.write_bytes(b"\x89PNG\r\n\x1a\n" +
        bloco(b"IHDR", struct.pack(">IIBBBBB", largura, altura, 8, 6, 0, 0, 0)) +
        bloco(b"IDAT", zlib.compress(linhas, 9)) + bloco(b"IEND", b""))


def salvar_luz_choque(largura, frames):
    """Analisa só o azul elétrico das faíscas; as bobinas douradas não emitem flashes."""
    amostras = []
    for pixels, _ in frames:
        pontos = [(i // 4 % largura, i // 4 // largura)
                  for i in range(0, len(pixels), 4)
                  if pixels[i] <= 80 and 140 <= pixels[i + 1] <= 200
                  and pixels[i + 2] >= 220 and pixels[i + 3] > 128]
        amostras.append(pontos)
    pico = max((len(pontos) for pontos in amostras), default=1) or 1
    quadros_luz = [dict(x=round(sum(x for x, _ in pontos) / len(pontos), 2),
                       y=round(sum(y for _, y in pontos) / len(pontos), 2),
                       intensidade=round((len(pontos) / pico) ** 0.5, 3))
                   if pontos else None for pontos in amostras]
    modulo = Path(__file__).resolve().parents[1] / "js/enemies/novoBoss/NovoBossTorreChoque.js"
    linhas = ",\n".join("  " + json.dumps(quadro) for quadro in quadros_luz)
    modulo.write_text(
        "/** Gerado por scripts/preparar-torres-boss.py a partir das faíscas do idle original. */\n"
        "export const quadrosChoqueTorreIdle = Object.freeze([\n" + linhas +
        "\n].map(quadro => quadro && Object.freeze(quadro)));\n")


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    metadados = {}
    for estado in ("summon", "idle", "attacked", "death"):
        largura, altura, frames = quadros((BASE / f"Queen_tower_{estado}.webp").read_bytes())
        colunas = min(4, len(frames))
        linhas = (len(frames) + colunas - 1) // colunas
        sheet = bytearray(largura * colunas * altura * linhas * 4)
        for indice, (pixels, _) in enumerate(frames):
            for y in range(altura):
                inicio = (((indice // colunas) * altura + y) * largura * colunas +
                          (indice % colunas) * largura) * 4
                sheet[inicio:inicio + largura * 4] = pixels[y * largura * 4:(y + 1) * largura * 4]
        salvar_png(SAIDA / f"torre-{estado}.png", largura * colunas, altura * linhas, sheet)
        metadados[estado] = {"largura": largura, "altura": altura,
                            "duracoesMs": [duracao for _, duracao in frames]}
        if estado == "idle":
            salvar_luz_choque(largura, frames)
        print(estado, len(frames), f"{largura}x{altura}")
    (SAIDA / "quadros.json").write_text(json.dumps(metadados, indent=2) + "\n")


if __name__ == "__main__":
    main()
