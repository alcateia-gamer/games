import { calcularRaioEscudoEnergia } from "./NovoBossEfeitosEnergia.js";
import { criarSomCargaEscudoBoss } from "../../sounds/raioEscotilhaBoss.js";

const TRACOS = [[14, 0x167bff, 0.15], [5, 0x31b9ff, 0.8], [2, 0xd7f8ff, 1]];

/** Quatro conexões visuais temporárias; um único Graphics, sem projéteis ou física. */
export function criarRaiosEscudoNovoBoss(scene, encontro, torres) {
  if (!scene.add?.graphics) return null;
  const visual = scene.add.graphics().setDepth(53).setName("novo-boss-raios-torres").setVisible(false);
  const som = criarSomCargaEscudoBoss(scene);
  const segmentos = 12;
  const pontos = torres.map(() => Array.from({ length: segmentos + 1 }, () => ({ x: 0, y: 0 })));
  let destruido = false;
  return {
    atualizar(tempo, alcance = 1, alpha = 1) {
      if (destruido) return;
      visual.clear().setVisible(alpha > 0 && alcance > 0).setAlpha(Math.max(0, Math.min(1, alpha)));
      som.atualizar(torres.length && visual.visible
        ? Math.max(0, Math.min(1, alcance)) * Math.max(0, Math.min(1, alpha)) : 0);
      if (!visual.visible) return;
      const boss = encontro.sprite;
      const raio = calcularRaioEscudoEnergia(encontro.config.geradores.raioBarreira ?? 95,
        encontro.sistemaGeradores?.cargaEscudo ?? 0);
      const fracao = Math.max(0, Math.min(1, alcance));
      for (let indice = 0; indice < torres.length; indice++) {
        const origem = torres[indice].pontoEmissor;
        const centroDx = boss.x - origem.x, centroDy = boss.y + 16 - origem.y;
        const distancia = Math.hypot(centroDx, centroDy);
        // Interseção mais próxima da torre: os raios param no contorno, sem atravessar o círculo.
        const fator = distancia > 0 ? Math.max(0, distancia - raio) / distancia : 0;
        const dx = centroDx * fator, dy = centroDy * fator;
        const tamanho = Math.max(1, Math.hypot(dx, dy));
        const path = pontos[indice];
        for (let i = 0; i <= segmentos; i++) {
          const p = i / segmentos;
          const desvio = i === 0 || i === segmentos ? 0 :
            Math.sin(i * 2.7 + tempo / 42 + indice * 1.9) * Math.sin(p * Math.PI) * 5;
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
    destruir() { if (!destruido) { destruido = true; som.destruir(); visual.destroy(); } },
  };
}
