#!/usr/bin/env python3
"""Gera o MP4 de streaming e o atlas da TV, sem alterar os arquivos originais.

Dependências de preparação: Pillow e ffmpeg (ou imageio-ffmpeg).
Uso: python scripts/preparar-cutscene-tv.py [--ffmpeg /caminho/ffmpeg]
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def faststart(path):
    atoms = []
    with path.open("rb") as stream:
        while header := stream.read(8):
            if len(header) != 8:
                break
            size, kind = struct.unpack(">I4s", header)
            atoms.append(kind.decode("ascii"))
            if size < 8:
                break
            stream.seek(size - 8, 1)
    return "moov" in atoms and "mdat" in atoms and atoms.index("moov") < atoms.index("mdat")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg")
    parser.add_argument("--television-only", action="store_true", help="Extrai só o quadro estático da TV original, sem recodificar o vídeo")
    args = parser.parse_args()
    directory = ROOT / "assets/efeitos/derivados"
    directory.mkdir(exist_ok=True)
    original_tv = ROOT / "assets/efeitos/televisao.gif"
    tv_hash = sha256(original_tv)
    tv = Image.open(original_tv)
    timings = []
    for frame in range(tv.n_frames):
        tv.seek(frame)
        timings.append(tv.info.get("duration", 0))
    tv.convert("RGBA").save(directory / "televisao-estatica.png")
    tv_report = {"original_sha256": tv_hash, "resolution": list(tv.size),
        "frames": tv.n_frames, "durations_ms": timings, "duration_ms": sum(timings),
        "hold_frame": tv.n_frames - 1,
        "screen": {"x": 226, "y": 190, "width": 286, "height": 199},
        "fit": "contain: preservar o GIF completo, sem zoom ou recorte"}
    (directory / "televisao-original.json").write_text(json.dumps(tv_report, indent=2) + "\n")
    assert sha256(original_tv) == tv_hash
    if args.television_only:
        print(json.dumps(tv_report))
        return
    executable = args.ffmpeg or shutil.which("ffmpeg")
    if not executable:
        import imageio_ffmpeg
        executable = imageio_ffmpeg.get_ffmpeg_exe()
    source = ROOT / "assets/efeitos/cutscene.mp4"
    gif = ROOT / "assets/efeitos/televisao-horror.gif"
    originals = {str(p.relative_to(ROOT)): sha256(p) for p in [source, gif, ROOT / "assets/efeitos/televisao.gif"]}
    output = directory / "cutscene-tv.mp4"
    # Apenas as duas inserções de ruído vertical recebem recorte central 4:3.
    # Rostos, títulos e o trecho de código verde mantêm o enquadramento original.
    filters = (
        "[0:v]split=3[base][green][red];"
        "[base]scale=960:720:flags=lanczos,setsar=1[normal];"
        "[green]crop=680:510:378:285,scale=960:720:flags=lanczos,setsar=1[g];"
        "[red]crop=832:624:306:228,scale=960:720:flags=lanczos,setsar=1[r];"
        "[normal][g]overlay=0:0:enable='gte(t,16.95)*lt(t,17.67)'[withgreen];"
        "[withgreen][r]overlay=0:0:enable='gte(t,19.95)*lt(t,20.87)'[video]"
    )
    subprocess.run([executable, "-hide_banner", "-loglevel", "error", "-i", str(source),
        "-filter_complex", filters, "-map", "[video]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-profile:v", "main", "-level", "3.1", "-c:a", "copy", "-movflags", "+faststart",
        "-map_metadata", "-1", "-y", str(output)], check=True)
    image = Image.open(gif)
    delays = []
    for frame in range(image.n_frames):
        image.seek(frame)
        delays.append(image.info.get("duration", 0))
    # Extração sem editar a arte: o canvas compõe e limpa a tela/escrita em runtime.
    columns = 9
    atlas = Image.new("RGBA", (image.width * columns, image.height * ((image.n_frames + columns - 1) // columns)))
    for frame in range(image.n_frames):
        image.seek(frame)
        atlas.paste(image.convert("RGBA"), ((frame % columns) * image.width, (frame // columns) * image.height))
    atlas.save(directory / "televisao-horror-quadros.png", optimize=True)
    # A TV aproxima-se da câmera; medições de conteúdo ficam restritas à tela,
    # para não confundir a iluminação azul da sala com a imagem do monitor.
    rectangles = []
    for frame in range(image.n_frames):
        image.seek(frame)
        left, top = int(70 - .6 * frame), int(66 - .6 * frame)
        right, bottom = int(231 + .7 * frame), int(187 + .4 * frame)
        pixels = image.convert("RGB")
        points = [(x, y) for y in range(top, bottom) for x in range(left, right)
                  if max(pixels.getpixel((x, y))) > 60]
        xs, ys = zip(*points)
        rectangles.append([min(xs), min(ys), max(xs) + 1, max(ys) + 1])
    # Nos quadros escuros e no reset com interferência, usar as bordas da TV
    # conferidas nos vizinhos, sem rastrear as faixas de ruído que cruzam a sala.
    rectangles[:4] = [rectangles[4][:] for _ in range(4)]
    for frame in [38, 39]:
        rectangles[frame] = [round(a + (b - a) * (frame - 37) / 3)
                             for a, b in zip(rectangles[37], rectangles[40])]
    rectangles[50] = rectangles[49][:]
    rectangles[51:] = [rectangles[0][:] for _ in range(3)]
    metadata = {"width": image.width, "height": image.height, "columns": columns,
        "durations": delays, "screens": [
            {"x": l - 1, "y": t - 1, "width": r - l + 2, "height": b - t + 2}
            for l, t, r, b in rectangles]}
    (directory / "televisao-horror-quadros.json").write_text(json.dumps(metadata, indent=2) + "\n")
    for path, expected in originals.items():
        assert sha256(ROOT / path) == expected, f"Original alterado: {path}"
    assert faststart(output), "O MP4 precisa começar sem baixar o arquivo inteiro"
    report = {"originais_sha256": originals,
        "gif": {"resolucao": list(image.size), "quadros": image.n_frames,
            "duracoes_ms": delays, "loop_ms": sum(delays)},
        "tela_gif": "Retângulos por quadro em televisao-horror-quadros.json; imagem central e escrita ocultadas na composição.",
        "video": {"original_bytes": source.stat().st_size, "derivado_bytes": output.stat().st_size,
            "resolucao_derivada": [960, 720], "faststart": True,
            "ajuste": "contain; apenas o ruído verde/vermelho vertical recebe recorte proporcional 4:3",
            "ruido_verde": {"primeiro_quadro": 424, "ultimo_quadro": 441, "recorte_xywh": [378, 285, 680, 510]},
            "ruido_vermelho": {"primeiro_quadro": 499, "ultimo_quadro": 521, "recorte_xywh": [306, 228, 832, 624]}}}
    (directory / "cutscene-tv.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report["video"], ensure_ascii=False))


if __name__ == "__main__":
    main()
