/** Troca a cor dos detalhes da HUD preservando luzes, sombras e transparência da fonte. */
export function colorirPixelHUD(pixels, i, cor) {
  const minimo = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
  const amplitude = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - minimo;
  const canais = [cor >> 16 & 255, cor >> 8 & 255, cor & 255];
  const maximo = Math.max(...canais);
  if (!maximo) return;
  for (let canal = 0; canal < 3; canal++) {
    pixels[i + canal] = Math.round(minimo + amplitude * canais[canal] / maximo);
  }
}

/** A detecção do preenchimento deixa de fora o contorno fino e sua suavização. */
export function colorirContornoEstaminaHUD(pixels, largura, altura, estamina, vida, cor) {
  const direita = estamina.x + estamina.width;
  const baixo = estamina.y + estamina.height;
  const fimY = Math.min(altura, Math.floor((baixo + vida.y) / 2));
  for (let y = 0; y < fimY; y++) {
    for (let x = estamina.x; x < largura; x++) {
      // O preenchimento ainda precisa ser detectado na cor da imagem original.
      if (x < direita && y >= estamina.y && y < baixo) continue;
      const i = (y * largura + x) * 4;
      if (pixels[i + 3] > 0 && pixels[i + 1] > pixels[i] && pixels[i + 2] > pixels[i]) {
        colorirPixelHUD(pixels, i, cor);
      }
    }
  }
}

/**
 * Isola o anel ciano conectado ao redor do retrato. Os detalhes ciano do personagem,
 * como os brincos da Aria, formam componentes separados e conservam seus pixels.
 */
export function colorirMolduraHUD(pixels, largura, altura, larguraRetrato, cor) {
  const limite = Math.min(largura, Math.floor(larguraRetrato));
  const total = limite * altura;
  const visitados = new Uint8Array(total);
  const fila = new Uint32Array(total);
  let moldura = [];
  const ehCiano = i => pixels[i + 3] > 0 &&
    pixels[i + 1] > pixels[i] * 3 + 8 && pixels[i + 2] > pixels[i] * 3 + 8;
  const ehContorno = i => ehCiano(i) && pixels[i + 3] > 128 &&
    Math.max(pixels[i + 1], pixels[i + 2]) >= 130;

  for (let inicio = 0; inicio < total; inicio++) {
    if (visitados[inicio]) continue;
    visitados[inicio] = 1;
    const x = inicio % limite, y = Math.floor(inicio / limite);
    if (!ehContorno((y * largura + x) * 4)) continue;
    let lidos = 0, tamanho = 1;
    let esquerda = x, direita = x, topo = y, baixo = y;
    fila[0] = inicio;
    while (lidos < tamanho) {
      const posicao = fila[lidos++];
      const px = posicao % limite, py = Math.floor(posicao / limite);
      esquerda = Math.min(esquerda, px); direita = Math.max(direita, px);
      topo = Math.min(topo, py); baixo = Math.max(baixo, py);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= limite || ny >= altura) continue;
        const proximo = ny * limite + nx;
        if (visitados[proximo]) continue;
        visitados[proximo] = 1;
        if (ehContorno((ny * largura + nx) * 4)) fila[tamanho++] = proximo;
      }
    }
    if (tamanho > moldura.length && direita - esquerda > limite * 0.6 &&
        baixo - topo > altura * 0.6) moldura = fila.slice(0, tamanho);
  }

  // Inclui a suavização próxima à borda, sem alcançar os detalhes internos do retrato.
  const mascara = new Uint8Array(total);
  const margem = 4;
  for (const posicao of moldura) {
    const x = posicao % limite, y = Math.floor(posicao / limite);
    for (let dy = -margem; dy <= margem; dy++) for (let dx = -margem; dx <= margem; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < limite && ny < altura && dx * dx + dy * dy <= margem * margem) {
        mascara[ny * limite + nx] = 1;
      }
    }
  }
  for (let posicao = 0; posicao < total; posicao++) {
    if (!mascara[posicao]) continue;
    const i = (Math.floor(posicao / limite) * largura + posicao % limite) * 4;
    if (ehCiano(i)) colorirPixelHUD(pixels, i, cor);
  }
}
