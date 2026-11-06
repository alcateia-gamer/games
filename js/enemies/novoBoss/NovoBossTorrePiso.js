/** Usa o piso real do mapa nas tampas, conservando seus relevos e a abertura. */
export function aplicarPisoNaBase(pixels, largura, asset, piso, escala, origemX, origemY) {
  for (let i = 0; i < pixels.length; i += 4) {
    const x = (i / 4 % largura) % asset.larguraFrame;
    const y = Math.floor(i / 4 / largura) % asset.alturaFrame;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    // Só a paleta verde-petróleo da plataforma. Armadura, setas e raios ficam intactos.
    if (y < 66 || !pixels[i + 3] || r > 80 || g > 110 ||
        g < r + 2 || b > g || g - b > 2) continue;
    const px = ((Math.floor(origemX + x * escala) % piso.width) + piso.width) % piso.width;
    const py = ((Math.floor(origemY + y * escala) % piso.height) + piso.height) % piso.height;
    const indice = (py * piso.width + px) * 4;
    // O tom principal recebe o tile exato; parafusos, bordas e sombras mantêm o relevo.
    const relevo = g / 75;
    for (let canal = 0; canal < 3; canal++) {
      pixels[i + canal] = Math.min(255, Math.round(piso.data[indice + canal] * relevo));
    }
  }
}

/** Gera uma vez por piso/alinhamento; todos os quadros continuam sendo sprites comuns. */
export function prepararPisoTorre(scene, ponto, poses) {
  const tile = scene.map?.getTileAtWorldXY?.(ponto.x, ponto.y, false, undefined, "chão");
  const tileset = scene.map?.tilesets?.find(t => t.containsTileIndex(tile?.index));
  const coordenadas = tileset?.getTileTextureCoordinates(tile.index);
  if (!coordenadas || !tileset.image || typeof document === "undefined") return poses;

  const escala = Math.min(ponto.width, ponto.height) / 192;
  const origemX = ponto.x - 96 * escala;
  const origemY = ponto.y + ponto.height / 2 - 258 * escala;
  const fase = (valor, tamanho) => ((valor % tamanho) + tamanho) % tamanho;
  const faseX = fase(origemX, tileset.tileWidth), faseY = fase(origemY, tileset.tileHeight);
  const sufixo = `piso-${tileset.name}-${tile.index}-${escala}-${faseX}-${faseY}`;
  const resultado = {};
  let piso;
  for (const [estado, asset] of Object.entries(poses)) {
    const chave = `${asset.chave}-${sufixo}`;
    if (!scene.textures.exists(chave)) {
      if (!piso) {
        const amostra = document.createElement("canvas");
        amostra.width = tileset.tileWidth;
        amostra.height = tileset.tileHeight;
        const contexto = amostra.getContext("2d", { willReadFrequently: true });
        contexto.drawImage(tileset.image.getSourceImage(), coordenadas.x, coordenadas.y,
          amostra.width, amostra.height, 0, 0, amostra.width, amostra.height);
        piso = contexto.getImageData(0, 0, amostra.width, amostra.height);
      }
      const fonte = scene.textures.get(asset.chave).getSourceImage();
      const canvas = document.createElement("canvas");
      canvas.width = fonte.width;
      canvas.height = fonte.height;
      const contexto = canvas.getContext("2d", { willReadFrequently: true });
      contexto.drawImage(fonte, 0, 0);
      const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height);
      aplicarPisoNaBase(imagem.data, canvas.width, asset, piso, escala, faseX, faseY);
      contexto.putImageData(imagem, 0, 0);
      scene.textures.addSpriteSheet(chave, canvas, {
        frameWidth: asset.larguraFrame, frameHeight: asset.alturaFrame,
        startFrame: 0, endFrame: asset.ultimoFrame,
      });
    }
    resultado[estado] = { ...asset, chave };
  }
  return resultado;
}
