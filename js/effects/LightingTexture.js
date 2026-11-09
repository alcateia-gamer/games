/** A máscara só desenha e envia a imagem: não precisa de leitura de pixels por quadro. */
export function criarTexturaIluminacao(textures, key, width, height) {
  if (!textures.addCanvas) return textures.createCanvas(key, width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // O primeiro getContext define o modo do canvas. CanvasTexture pede leitura frequente
  // por padrão, o que força composição na CPU mesmo sem getImageData durante a partida.
  canvas.getContext("2d", { willReadFrequently: false });
  return textures.addCanvas(key, canvas);
}
