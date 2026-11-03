/** Armadilhas visíveis com contenção de fonte própria, sem dano adicional. */
import { criarVisualTentaculo } from "../NovoBossTentaculoVisual.js";

let proximaExecucao = 0;

const padrao = Object.freeze({
  quantidade: 3,
  raio: 18,
  avisoMs: 1000,
  ativoMs: 3500,
  agarrarMs: 2500,
});

function numero(valor, fallback, minimo = 0) {
  return Number.isFinite(valor) ? Math.max(minimo, valor) : fallback;
}

export function criarTentaculos(scene, encontro, config = {}, servicos = {}) {
  const ajustes = { ...padrao, ...config };
  for (const chave of Object.keys(padrao)) ajustes[chave] = numero(ajustes[chave], padrao[chave]);
  ajustes.quantidade = Math.max(1, Math.floor(ajustes.quantidade));
  ajustes.raio = Math.max(1, ajustes.raio);
  // Regra confirmada: não há dano extra nem ação para encurtar o agarrão.
  ajustes.agarrarMs = Math.max(2000, Math.min(3000, ajustes.agarrarMs));
  const arena = encontro.config.arena;
  const fimAtivo = ajustes.avisoMs + ajustes.ativoMs;
  const duracao = fimAtivo + ajustes.agarrarMs;
  const execucao = ++proximaExecucao;
  const armadilhas = [];
  const rng = () => Math.max(0, Math.min(0.999999, numero(servicos.rng?.() ?? Math.random(), 0.5)));
  const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));
  const grafico = scene.add?.graphics?.();
  grafico?.setDepth?.(52);
  let decorrido = 0;
  let terminado = false;
  let destruido = false;

  function pontoAleatorio() {
    return {
      x: arena.xMin + ajustes.raio + rng() * Math.max(0, arena.xMax - arena.xMin - ajustes.raio * 2),
      y: arena.yMin + ajustes.raio + rng() * Math.max(0, arena.yMax - arena.yMin - ajustes.raio * 2),
    };
  }

  function valido(ponto) {
    return ponto.x >= arena.xMin + ajustes.raio && ponto.x <= arena.xMax - ajustes.raio &&
      ponto.y >= arena.yMin + ajustes.raio && ponto.y <= arena.yMax - ajustes.raio &&
      servicos.pontoLivre?.(ponto.x, ponto.y, ajustes.raio) !== false &&
      armadilhas.every((outra) => Math.hypot(ponto.x - outra.x, ponto.y - outra.y) >= ajustes.raio * 2 + 12);
  }

  // Congela a primeira marca na posição atual do jogador. As demais são
  // sorteadas em áreas livres e nunca passam a perseguir sua movimentação.
  for (let i = 0; i < ajustes.quantidade; i++) {
    let ponto = i === 0 ? {
      x: limitar(scene.player?.x ?? encontro.x, arena.xMin + ajustes.raio, arena.xMax - ajustes.raio),
      y: limitar(scene.player?.y ?? encontro.y, arena.yMin + ajustes.raio, arena.yMax - ajustes.raio),
    } : pontoAleatorio();
    let tentativas = 0;
    while (!valido(ponto) && tentativas++ < 40) ponto = pontoAleatorio();
    if (!valido(ponto)) continue;
    const armadilha = {
      ...ponto,
      id: `novo-boss-tentaculo-${execucao}-${i}`,
      aviso: servicos.criarAviso?.(ponto.x, ponto.y, ajustes.raio, ajustes.avisoMs),
      capturou: false,
      segurando: false,
      liberarEm: null,
    };
    armadilha.visual = criarVisualTentaculo(scene, ponto.x, ponto.y, ajustes.raio);
    armadilhas.push(armadilha);
  }

  function liberar(armadilha) {
    if (!armadilha.segurando) return;
    armadilha.segurando = false;
    servicos.liberarJogador?.(armadilha.id);
  }

  function removerAvisos() {
    for (const armadilha of armadilhas) {
      armadilha.aviso?.destruir?.();
      armadilha.aviso = null;
    }
  }

  function desenhar() {
    grafico?.clear();
    for (const armadilha of armadilhas) {
      const visivel = decorrido >= ajustes.avisoMs &&
        (armadilha.segurando || (decorrido < fimAtivo && !armadilha.capturou));
      armadilha.visual?.atualizar({
        idade: Math.max(0, decorrido - ajustes.avisoMs), visivel, segurando: armadilha.segurando,
        idadeCaptura: armadilha.segurando ? decorrido - (armadilha.liberarEm - ajustes.agarrarMs) : 0,
        alturaAlvo: scene.hitboxDanoPlayer?.height,
        x: armadilha.segurando ? scene.hitboxDanoPlayer?.centerX ?? scene.player?.x ?? armadilha.x : armadilha.x,
        y: armadilha.segurando ? scene.hitboxDanoPlayer?.centerY ?? scene.player?.y ?? armadilha.y : armadilha.y,
      });
      if (!visivel || !grafico) continue;
      const { x, y } = armadilha;
      const oscilacao = Math.sin(decorrido / 160 + x) * ajustes.raio * 0.16;
      grafico.fillStyle(0x6d172d, 0.7);
      grafico.fillCircle(x, y, ajustes.raio);
      grafico.lineStyle(3, 0xe83a60, 1);
      grafico.strokeCircle(x, y, ajustes.raio);
      if (armadilha.visual) continue;
      // Três segmentos curvos sugerem um tentáculo recolhendo o jogador.
      // A base indica exatamente a área de captura, sem colisão invisível.
      for (const sentido of [-1, 1]) {
        grafico.lineStyle(5, armadilha.segurando ? 0xff8994 : 0xc82d4c, 1);
        grafico.beginPath();
        grafico.moveTo(x + sentido * ajustes.raio * 0.65, y + ajustes.raio * 0.3);
        grafico.lineTo(x + sentido * ajustes.raio * 0.8 + oscilacao, y - ajustes.raio * 0.4);
        grafico.lineTo(x + sentido * ajustes.raio * 0.45, y - ajustes.raio * 1.2);
        grafico.lineTo(x + oscilacao, y - ajustes.raio * 1.35);
        grafico.strokePath();
      }
    }
  }

  function destruir() {
    if (destruido) return;
    destruido = true;
    terminado = true;
    removerAvisos();
    for (const armadilha of armadilhas) {
      liberar(armadilha);
      armadilha.visual?.destruir();
    }
    grafico?.destroy?.();
  }

  return {
    tipo: "tentaculos",
    duracao,
    atualizar(delta) {
      if (terminado) return true;
      decorrido += numero(delta, 0);
      for (const armadilha of armadilhas) {
        if (armadilha.aviso) armadilha.aviso.atualizar?.(
          ajustes.avisoMs === 0 ? 1 : Math.min(1, decorrido / ajustes.avisoMs),
        );
        if (armadilha.segurando && decorrido >= armadilha.liberarEm) liberar(armadilha);
      }
      if (decorrido >= ajustes.avisoMs) removerAvisos();
      if (decorrido >= ajustes.avisoMs && decorrido < fimAtivo) {
        for (const armadilha of armadilhas) {
          if (armadilha.capturou || !servicos.jogadorAtingeCirculo?.(armadilha.x, armadilha.y, ajustes.raio)) continue;
          if (!servicos.capturarJogador?.(armadilha.id, ajustes.agarrarMs)) continue;
          armadilha.capturou = true;
          armadilha.segurando = true;
          armadilha.liberarEm = decorrido + ajustes.agarrarMs;
        }
      }
      if (decorrido >= fimAtivo && !armadilhas.some((armadilha) => armadilha.segurando)) {
        destruir();
        return true;
      }
      desenhar();
      return false;
    },
    destruir,
    snapshot: () => ({
      tipo: "tentaculos", decorrido, terminado,
      avisando: !terminado && decorrido < ajustes.avisoMs,
      armadilhas: armadilhas.map(({ id, x, y, capturou, segurando, liberarEm }) => ({
        id, x, y, raio: ajustes.raio, capturou, segurando, liberarEm,
        ativa: !terminado && decorrido >= ajustes.avisoMs && decorrido < fimAtivo && !capturou,
      })),
    }),
  };
}
