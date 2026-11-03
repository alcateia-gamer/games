/** Armadilhas visíveis com contenção de fonte própria, sem dano adicional. */
import { criarVisualTentaculo } from "../NovoBossTentaculoVisual.js";

let proximaExecucao = 0;

const padrao = Object.freeze({
  quantidadeMinima: 8,
  quantidadeMaxima: 12,
  distanciaMinima: 120,
  distanciaMaxima: 300,
  apertosParaLibertar: 8,
  raio: 18,
  avisoMs: 1000,
  ativoMs: 18000,
  agarrarMs: 2500,
});

function numero(valor, fallback, minimo = 0) {
  return Number.isFinite(valor) ? Math.max(minimo, valor) : fallback;
}

export function criarTentaculos(scene, encontro, config = {}, servicos = {}) {
  const ajustes = { ...padrao, ...config };
  for (const chave of Object.keys(padrao)) ajustes[chave] = numero(ajustes[chave], padrao[chave]);

  ajustes.raio = Math.max(1, ajustes.raio);
  // Não há dano extra. A captura de produção termina pelos oito apertos de ataque.
  ajustes.agarrarMs = Math.max(2000, Math.min(3000, ajustes.agarrarMs));
  const arena = encontro.config.arena;
  const fimAtivo = ajustes.avisoMs + ajustes.ativoMs;
  const duracao = fimAtivo + ajustes.agarrarMs;
  const execucao = ++proximaExecucao;
  const armadilhas = [];
  const rng = () => Math.max(0, Math.min(0.999999, numero(servicos.rng?.() ?? Math.random(), 0.5)));
  const minimo = Math.max(8, Math.min(12, Math.floor(ajustes.quantidadeMinima)));
  const maximo = Math.max(minimo, Math.min(12, Math.floor(ajustes.quantidadeMaxima)));
  const quantidade = Number.isFinite(config.quantidade) ? Math.max(1, Math.floor(config.quantidade))
    : minimo + Math.floor(rng() * (maximo - minimo + 1));
  const origem = { x: encontro.sprite?.x ?? encontro.x ?? 0, y: encontro.sprite?.y ?? encontro.y ?? 0 };
  const distanciaMinima = ajustes.distanciaMinima;
  const distanciaMaxima = Math.max(distanciaMinima, ajustes.distanciaMaxima);
  const requerApertos = ajustes.apertosParaLibertar > 0;
  const grafico = scene.add?.graphics?.();
  grafico?.setDepth?.(52);
  let decorrido = 0;
  let terminado = false;
  let destruido = false;

  function pontoAleatorio() {
    const angulo = rng() * Math.PI * 2;
    const distancia = Math.sqrt(distanciaMinima ** 2 + rng() * (distanciaMaxima ** 2 - distanciaMinima ** 2));
    return { x: origem.x + Math.cos(angulo) * distancia, y: origem.y + Math.sin(angulo) * distancia };
  }

  function valido(ponto) {
    const distancia = Math.hypot(ponto.x - origem.x, ponto.y - origem.y);
    return distancia >= distanciaMinima - 0.001 && distancia <= distanciaMaxima + 0.001 &&
      ponto.x >= arena.xMin + ajustes.raio && ponto.x <= arena.xMax - ajustes.raio &&
      ponto.y >= arena.yMin + ajustes.raio && ponto.y <= Math.min(arena.yMax, arena.entradaY ?? arena.yMax) - ajustes.raio &&
      servicos.pontoLivre?.(ponto.x, ponto.y, ajustes.raio) !== false &&
      armadilhas.every(outra => Math.hypot(ponto.x - outra.x, ponto.y - outra.y) >= ajustes.raio * 2 + 12);
  }

  const rotacaoReserva = rng() * Math.PI * 2;
  function procurarReserva() {
    // Só usa posições locais; RNG repetitivo ou paredes não espalham o ataque pelo mapa.
    for (let raio = distanciaMinima; raio <= distanciaMaxima; raio += ajustes.raio * 2 + 12) {
      const setores = Math.max(12, Math.ceil(Math.PI * 2 * raio / (ajustes.raio * 2 + 12)));
      for (let i = 0; i < setores; i++) {
        const angulo = rotacaoReserva + i / setores * Math.PI * 2;
        const ponto = { x: origem.x + Math.cos(angulo) * raio, y: origem.y + Math.sin(angulo) * raio };
        if (valido(ponto)) return ponto;
      }
    }
    return null;
  }

  for (let i = 0; i < quantidade; i++) {
    let ponto = null;
    for (let tentativa = 0; tentativa < 60 && !ponto; tentativa++) {
      const candidato = pontoAleatorio();
      if (valido(candidato)) ponto = candidato;
    }
    ponto ??= procurarReserva();
    if (!ponto) continue;
    const armadilha = {
      ...ponto,
      id: `novo-boss-tentaculo-${execucao}-${i}`,
      aviso: servicos.criarAviso?.(ponto.x, ponto.y, ajustes.raio, ajustes.avisoMs),
      capturou: false,
      segurando: false,
      liberarEm: null, capturouEm: null,
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
        idadeCaptura: armadilha.segurando ? decorrido - armadilha.capturouEm : 0,
        alturaAlvo: scene.hitboxDanoPlayer?.height,
        x: armadilha.x,
        y: armadilha.y,
      });
      if (!visivel || !grafico || armadilha.visual) continue;
      const { x, y } = armadilha;
      const oscilacao = Math.sin(decorrido / 160 + x) * ajustes.raio * 0.16;
      grafico.fillStyle(0x6d172d, 0.7);
      grafico.fillCircle(x, y, ajustes.raio);
      grafico.lineStyle(3, 0xe83a60, 1);
      grafico.strokeCircle(x, y, ajustes.raio);
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
    get duracao() { return requerApertos && armadilhas.some(a => a.segurando) ? Infinity : duracao; },
    atualizar(delta) {
      if (terminado) return true;
      decorrido += numero(delta, 0);
      for (const armadilha of armadilhas) {
        if (armadilha.aviso) armadilha.aviso.atualizar?.(
          ajustes.avisoMs === 0 ? 1 : Math.min(1, decorrido / ajustes.avisoMs),
        );
        if (armadilha.segurando && (servicos.capturaAtiva?.(armadilha.id) === false ||
            (armadilha.liberarEm !== null && decorrido >= armadilha.liberarEm))) liberar(armadilha);
      }
      if (decorrido >= ajustes.avisoMs) removerAvisos();
      if (decorrido >= ajustes.avisoMs && decorrido < fimAtivo) {
        for (const armadilha of armadilhas) {
          if (armadilha.capturou || !servicos.jogadorAtingeCirculo?.(armadilha.x, armadilha.y, ajustes.raio)) continue;
          if (!servicos.capturarJogador?.(armadilha.id, ajustes.agarrarMs, { x: armadilha.x, y: armadilha.y },
            { apertos: ajustes.apertosParaLibertar })) continue;
          armadilha.capturou = true;
          armadilha.segurando = true;
          armadilha.capturouEm = decorrido;
          armadilha.liberarEm = requerApertos ? null : decorrido + ajustes.agarrarMs;
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
      tipo: "tentaculos", decorrido, terminado, quantidade, origem: { ...origem },
      distanciaMinima, distanciaMaxima, apertosParaLibertar: ajustes.apertosParaLibertar,
      avisando: !terminado && decorrido < ajustes.avisoMs,
      armadilhas: armadilhas.map(({ id, x, y, capturou, segurando, liberarEm }) => ({
        id, x, y, raio: ajustes.raio, capturou, segurando, liberarEm,
        ativa: !terminado && decorrido >= ajustes.avisoMs && decorrido < fimAtivo && !capturou,
      })),
    }),
  };
}
