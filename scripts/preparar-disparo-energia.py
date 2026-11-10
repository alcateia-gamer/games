"""Extrai a animação de energia sem redesenhar, redimensionar ou quantizar cores.

Requer Pillow. --preparar gera derivados; --verificar confere todos os pixels.
A opção B (remover também preto puro fechado pelos anéis) foi escolhida pelo
usuário após a prévia dos quadros 1, 31 e 46. Só RGB (0, 0, 0) é removido.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops

RAIZ = Path(__file__).resolve().parents[1]
PASTA = RAIZ / "assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal"
FONTE = PASTA / "disparo-energia.gif"
DESTINO = PASTA / "derivados"
GIF = "disparo-energia-transparente.gif"
FOLHA = "disparo-energia-quadros.png"
MANIFESTO = "disparo-energia.json"
COLUNAS = 8
QUADROS_POR_PAGINA = 32
COLUNAS_PAGINA = 4


def remover_preto(quadro):
    """Só altera alfa de preto puro; não altera RGB nem tons azuis escuros."""
    resultado = quadro.convert("RGBA").copy()
    r, g, b, alfa = resultado.split()
    colorido = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mascara = colorido.point(lambda valor: 0 if valor == 0 else 255)
    resultado.putalpha(ImageChops.darker(alfa, mascara))
    return resultado


def ler_fonte():
    hash_original = hashlib.sha256(FONTE.read_bytes()).hexdigest()
    originais, quadros, duracoes = [], [], []
    with Image.open(FONTE) as gif:
        tamanho, loop = gif.size, gif.info.get("loop")
        assert gif.n_frames == 61, "Reavaliar a prévia se a fonte mudar de sequência."
        for indice in range(gif.n_frames):
            gif.seek(indice)
            original = gif.convert("RGBA").copy()
            originais.append(original)
            quadros.append(remover_preto(original))
            duracoes.append(gif.info["duration"])
    return hash_original, tamanho, loop, originais, quadros, duracoes


def folha(quadros, colunas):
    largura, altura = quadros[0].size
    imagem = Image.new("RGBA", (largura * colunas,
        altura * ((len(quadros) + colunas - 1) // colunas)))
    for indice, quadro in enumerate(quadros):
        # Sem máscara de paste: copia inclusive o alfa e os RGB originais.
        imagem.paste(quadro, (indice % colunas * largura, indice // colunas * altura))
    return imagem


def gravar_gif(quadros, duracoes, loop):
    # Paleta exata, sem quantização: 200 cores visíveis + índice transparente.
    cores = sorted({rgb[:3] for quadro in quadros for rgb in quadro.get_flattened_data() if rgb[3]})
    assert len(cores) <= 255, "Paleta excede o GIF; não reduzir cores automaticamente."
    indices = {cor: i + 1 for i, cor in enumerate(cores)}
    paleta = [0, 0, 0] + [canal for cor in cores for canal in cor]
    paleta += [0] * (768 - len(paleta))
    frames = []
    for quadro in quadros:
        pixels = bytes(indices[p[:3]] if p[3] else 0 for p in quadro.get_flattened_data())
        imagem = Image.frombytes("P", quadro.size, pixels)
        imagem.putpalette(paleta)
        frames.append(imagem)
    opcoes = {} if loop is None else {"loop": loop}
    frames[0].save(DESTINO / GIF, save_all=True, append_images=frames[1:],
        duration=duracoes, transparency=0, background=0, disposal=2,
        optimize=False, **opcoes)


def conferir_pixel_a_pixel(esperado, atual, nome):
    assert atual.size == esperado.size, (nome, "Dimensões alteradas")
    assert atual.convert("RGBA").tobytes() == esperado.tobytes(), (nome, "Pixels alterados")


def executar(verificar):
    hash_original, tamanho, loop, originais, quadros, duracoes = ler_fonte()
    if not verificar:
        # A geração integral só ocorre depois de uma prévia ter sido apresentada.
        assert (DESTINO / "disparo-energia-previa-interiores.png").exists(), "Gerar a prévia antes."
        DESTINO.mkdir(exist_ok=True)
    imagens = {FOLHA: folha(quadros, COLUNAS)}
    paginas = []
    for inicio in range(0, len(quadros), QUADROS_POR_PAGINA):
        parte = quadros[inicio:inicio + QUADROS_POR_PAGINA]
        nome = f"disparo-energia-pagina-{len(paginas) + 1}.png"
        imagens[nome] = folha(parte, COLUNAS_PAGINA)
        assert max(imagens[nome].size) <= 4096, "Página excede textura de 4096px."
        paginas.append({"arquivo": nome, "primeiroQuadro": inicio, "quadros": len(parte),
            "colunas": COLUNAS_PAGINA})
    manifesto = {
        "original": FONTE.name, "sha256Original": hash_original,
        "larguraFrame": tamanho[0], "alturaFrame": tamanho[1], "quadros": len(quadros),
        "duracoesMs": duracoes, "duracaoTotalMs": sum(duracoes), "loop": loop,
        "gif": GIF, "folha": FOLHA, "colunas": COLUNAS, "paginasJogo": paginas,
        "criterio": "RGB 0,0,0 transparente, incluindo interiores (opção B aprovada)",
        "pixelsRemovidosPorQuadro": [sum(p[3] == 0 for p in q.get_flattened_data()) for q in quadros],
        "coresVisiveis": len({p[:3] for q in quadros for p in q.get_flattened_data() if p[3]}),
    }
    if not verificar:
        for nome, imagem in imagens.items():
            imagem.save(DESTINO / nome, optimize=True)
        gravar_gif(quadros, duracoes, loop)
        (DESTINO / MANIFESTO).write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n")
    else:
        assert json.loads((DESTINO / MANIFESTO).read_text()) == manifesto, "Manifesto desatualizado"

    for nome, esperado in imagens.items():
        with Image.open(DESTINO / nome) as atual:
            conferir_pixel_a_pixel(esperado, atual, nome)
    with Image.open(DESTINO / GIF) as gif:
        assert gif.n_frames == len(quadros), "GIF perdeu quadros"
        assert gif.size == tamanho and gif.info.get("loop") == loop
        for indice, esperado in enumerate(quadros):
            gif.seek(indice)
            assert gif.info["duration"] == duracoes[indice], (indice, "Tempo alterado")
            conferir_pixel_a_pixel(esperado, gif, f"GIF quadro {indice + 1}")
    # Também confere o contrato da remoção contra a fonte, não só os exports.
    for original, quadro in zip(originais, quadros):
        for antes, depois in zip(original.get_flattened_data(), quadro.get_flattened_data()):
            assert antes[:3] == depois[:3], "RGB alterado"
            assert depois[3] == (0 if antes[:3] == (0, 0, 0) else antes[3]), "Máscara incorreta"
    assert hashlib.sha256(FONTE.read_bytes()).hexdigest() == hash_original, "Original alterado"
    print(f"61 quadros conferidos pixel a pixel, {sum(duracoes)} ms, {manifesto['coresVisiveis']} cores exatas; original preservado.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    modo = parser.add_mutually_exclusive_group(required=True)
    modo.add_argument("--preparar", action="store_true")
    modo.add_argument("--verificar", action="store_true")
    executar(parser.parse_args().verificar)
