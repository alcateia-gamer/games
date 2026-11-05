const TRACOS = [[14, 0x167bff, 0.15], [5, 0x31b9ff, 0.8], [2, 0xd7f8ff, 1]];

/** Quatro conexões visuais temporárias; um único Graphics, sem projéteis ou física. */
export function criarRaiosEscudoNovoBoss(scene, encontro, torres) {
  if (!scene.add?.graphics) return null;
  const visual = scene.add.graphics().setDepth(53).setName("novo-boss-raios-torres").setVisible(false);
  const segmentos = 12;
  const pontos = torres.map(() => Array.from({ length: segmentos + 1 }, () => ({ x: 0, y: 0 })));
  let destruido = false;
  return {
    atualizar(tempo, alcance = 1, alpha = 1) {
      if (destruido) return;
      visual.clear().setVisible(alpha > 0 && alcance > 0).setAlpha(Math.max(0, Math.min(1, alpha)));
      if (!visual.visible) return;
      const boss = encontro.sprite;
      for (let indice = 0; indice < torres.length; indice++) {
        const origem = torres[indice].pontoEmissor;
        const dx = boss.x - origem.x, dy = boss.y + 16 - origem.y;
        const tamanho = Math.max(1, Math.hypot(dx, dy));
        const fracao = Math.max(0, Math.min(1, alcance));
        const path = pontos[indice];
        for (let i = 0; i <= segmentos; i++) {
          const p = i / segmentos;
          const desvio = Math.sin(i * 2.7 + tempo / 42 + indice * 1.9) * Math.sin(p * Math.PI) * 5;
          path[i].x = origem.x + dx * p * fracao - dy / tamanho * desvio;
          path[i].y = origem.y + dy * p * fracao + dx / tamanho * desvio;
        }
        for (const [largura, cor, opacidade] of TRACOS) {
          visual.lineStyle(largura, cor, opacidade).beginPath().moveTo(path[0].x, path[0].y);
          for (let i = 1; i <= segmentos; i++) visual.lineTo(path[i].x, path[i].y);
          visual.strokePath();
        }
        const p = (tempo / 480 + indice / torres.length) % 1 * fracao;
        visual.fillStyle(0xb4f3ff, 0.9).fillCircle(origem.x + dx * p, origem.y + dy * p, 4);
      }
    },
    destruir() { if (!destruido) { destruido = true; visual.destroy(); } },
  };
}
