"""Extrai a marcação do GIF em cópia RGBA, preservando fonte, células e sequência."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, GifImagePlugin

ROOT = Path(__file__).resolve().parents[1]
FONTE = ROOT / 'assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/are-de-ataque.gif'
DESTINO = FONTE.parent / 'derivados/area-ataque'

def preparar(verificar=False):
    quadros, tempos = [], []
    limites = None
    with Image.open(FONTE) as gif:
        tamanho = gif.size
        for indice in range(gif.n_frames):
            gif.seek(indice)
            quadro = gif.convert('RGBA')
            # Desfaz a composição do rosa sobre o fundo verde observado (91,171,128).
            # O contraste R-G recupera a cobertura, mantendo as bordas com alfa parcial.
            pixels=[]
            for r,g,b,a in quadro.get_flattened_data():
                cobertura=max(0,min(1,(r-g+80)/245))
                if cobertura < 0.02 or a == 0:
                    pixels.append((0,0,0,0))
                else:
                    cor=tuple(round(max(0,min(255,(v-(1-cobertura)*f)/cobertura)))
                              for v,f in zip((r,g,b),(91,171,128)))
                    pixels.append((*cor,round(a*cobertura)))
            quadro.putdata(pixels)
            bbox=quadro.getbbox()
            if bbox:
                limites=bbox if limites is None else (min(limites[0],bbox[0]),min(limites[1],bbox[1]),max(limites[2],bbox[2]),max(limites[3],bbox[3]))
            quadros.append(quadro)
            tempos.append(gif.info.get('duration',70))
    colunas=16
    folha=Image.new('RGBA',(tamanho[0]*colunas,tamanho[1]*((len(quadros)+colunas-1)//colunas)))
    for i,quadro in enumerate(quadros):
        folha.paste(quadro,((i%colunas)*tamanho[0],(i//colunas)*tamanho[1]))
    meta={'fonte':FONTE.name,'sha256Original':hashlib.sha256(FONTE.read_bytes()).hexdigest(),
          'quadros':len(quadros),'larguraFrame':tamanho[0],'alturaFrame':tamanho[1],
          'duracoesMs':tempos,'loop':0,'colunas':colunas,'limitesEfeito':limites,
          'alfaGIF':'Binário; PNG é a versão principal com transparência parcial.',
          'reproducao':'Sequência normalizada ao progresso do aviso; o quadro final coincide com o impacto.'}
    if verificar:
        assert json.loads((DESTINO/'area-ataque.json').read_text())==json.loads(json.dumps(meta))
        with Image.open(DESTINO/'area-ataque-quadros.png') as atual:
            assert atual.convert('RGBA').tobytes()==folha.tobytes()
        with Image.open(DESTINO/'area-ataque-transparente.gif') as gif:
            assert gif.n_frames==len(quadros)
            for i in range(gif.n_frames):
                gif.seek(i)
                assert gif.info['duration']==tempos[i]
                assert gif.convert('RGBA').getpixel((0,0))[3]==0
        print('Fonte, 109 quadros PNG/GIF, tempos, alfa e sequência conferidos.')
    else:
        DESTINO.mkdir(parents=True,exist_ok=True)
        folha.save(DESTINO/'area-ataque-quadros.png')
        with (DESTINO/'area-ataque-transparente.gif').open('wb') as arquivo:
            for i,quadro in enumerate(quadros):
                cores=sorted({p[:3] for p in quadro.get_flattened_data() if p[3]})
                assert len(cores)<=255
                indices={cor:j+1 for j,cor in enumerate(cores)}
                paleta=[0,0,0]+[v for cor in cores for v in cor]
                paleta += [0]*(768-len(paleta))
                frame=Image.frombytes('P',tamanho,bytes(indices[p[:3]] if p[3] else 0 for p in quadro.get_flattened_data()))
                frame.putpalette(paleta)
                if i==0:
                    header,_=GifImagePlugin.getheader(frame,info={'loop':0,'background':0,'optimize':False})
                    arquivo.write(b''.join(header))
                arquivo.write(b''.join(GifImagePlugin.getdata(frame,duration=tempos[i],transparency=0,disposal=2,include_color_table=i>0)))
            arquivo.write(b';')
        (DESTINO/'area-ataque.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n')
        quadros[len(quadros)//2].save(DESTINO/'area-ataque-previa.png')
        print(meta)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verificar',action='store_true')
    preparar(parser.parse_args().verificar)
