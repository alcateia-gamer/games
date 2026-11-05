"""Deriva animações dos GIFs sem alterar fontes, células ou tempos. Requer Pillow/numpy."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/efeitos/especiais'

def preparar(verificar=False, apenas_cura=False):
    fontes = [('nyx', ROOT/'Tilesets/mechanics/HolyNova_preview.gif', 4),
              ('magnus', ROOT/'Tilesets/mechanics/attack-area-magnus.gif', 8),
              ('nyx-cura', ROOT/'Tilesets/mechanics/Heal_preview.gif', 4)]
    for nome, fonte, colunas in fontes:
        if apenas_cura and nome != 'nyx-cura':
            continue
        frames, tempos = [], []
        with Image.open(fonte) as gif:
            loop = gif.info.get('loop', 0)
            for i in range(gif.n_frames):
                gif.seek(i)
                frame = gif.convert('RGBA')
                if nome in ('nyx', 'nyx-cura'):
                    pixels = np.array(frame)
                    fundo = np.all(pixels[:,:,:3] == (34,32,52), axis=2)
                    # Uma paleta roxa baseada na luminosidade mantém sombras e branco.
                    luz = pixels[:,:,:3].max(axis=2).astype(float)/255
                    calor = pixels[:,:,:3].min(axis=2).astype(float)/255
                    saturacao = np.clip((1-calor)*1.5, .08, .65)
                    pixels[:,:,0] = np.round(luz*(1-saturacao*.30)*255)
                    pixels[:,:,1] = np.round(luz*(1-saturacao)*255)
                    pixels[:,:,2] = np.round(luz*255)
                    pixels[fundo] = 0
                    frame = Image.fromarray(pixels)
                frames.append(frame)
                tempos.append(gif.info.get('duration', 100))
        w,h = frames[0].size
        sheet = Image.new('RGBA', (w*colunas, h*((len(frames)+colunas-1)//colunas)))
        for i,frame in enumerate(frames):
            sheet.paste(frame, (i%colunas*w, i//colunas*h))
        meta = dict(quadros=len(frames), larguraFrame=w, alturaFrame=h,
                    duracoesMs=tempos, loop=loop, colunas=colunas,
                    sha256Original=hashlib.sha256(fonte.read_bytes()).hexdigest(),
                    origem=str(fonte.relative_to(ROOT)))
        if verificar:
            assert json.loads((OUT/f'{nome}.json').read_text()) == meta
            with Image.open(OUT/f'{nome}.png') as saved:
                assert saved.convert('RGBA').tobytes() == sheet.tobytes()
            assert all(f.getpixel((0,0))[3] == 0 for f in frames)
            if nome == 'nyx-cura':
                with Image.open(OUT/'nyx-cura-transparente.gif') as gif:
                    assert gif.n_frames == len(frames)
                    for i,frame in enumerate(frames):
                        gif.seek(i)
                        assert gif.info['duration'] == tempos[i]
                        assert gif.convert('RGBA').tobytes() == frame.tobytes()
        else:
            OUT.mkdir(parents=True, exist_ok=True)
            sheet.save(OUT/f'{nome}.png')
            (OUT/f'{nome}.json').write_text(json.dumps(meta, indent=2)+'\n')
            if nome == 'nyx-cura':
                # A fonte tem alfa binário e poucas cores: GIF sem perda da paleta.
                cores=sorted({p[:3] for frame in frames for p in frame.get_flattened_data() if p[3]})
                assert len(cores)<=255
                indices={cor:i+1 for i,cor in enumerate(cores)}
                paleta=[0,0,0]+[v for cor in cores for v in cor]
                paleta += [0]*(768-len(paleta))
                gif_frames=[]
                for frame in frames:
                    convertido=Image.new('P',frame.size)
                    convertido.putpalette(paleta)
                    convertido.putdata([indices[p[:3]] if p[3] else 0 for p in frame.get_flattened_data()])
                    gif_frames.append(convertido)
                gif_frames[0].save(OUT/'nyx-cura-transparente.gif',save_all=True,
                    append_images=gif_frames[1:],duration=tempos,loop=loop,
                    transparency=0,disposal=2,optimize=False)
        print(f'{nome}: {len(frames)} quadros, {sum(tempos)}ms; fonte e alfa conferidos.')

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--verificar', action='store_true')
    parser.add_argument('--apenas-cura', action='store_true')
    args=parser.parse_args()
    preparar(args.verificar,args.apenas_cura)
