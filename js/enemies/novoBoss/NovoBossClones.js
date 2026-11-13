/** Clones móveis inofensivos; a verdadeira continua sendo a entidade original. */
import { tempoMovimentoNovoBoss } from "./NovoBossMovimento.js";
import { sincronizarCorpoNovoBoss } from "./NovoBossTeleporte.js";
import {
  criarAlvoIlusorio, destinoIlusorioValido, encontroIlusorioVisivel,
} from "./NovoBossIlusoes.js";

export function prepararClonesNovoBoss(scene, encontro) {
  const config = { ativo: true, quantidade: 9, duracaoMs: 18000, velocidade: 55, ...encontro.config.clones };
  const quantidadeConfigurada = Number(config.quantidade);
  const quantidade = Math.max(8, Math.min(10,
    Number.isFinite(quantidadeConfigurada) ? Math.floor(quantidadeConfigurada) : 9));
  const velocidade = Number.isFinite(config.velocidade) && config.velocidade > 0 ? config.velocidade : 55;
  const duracaoMs = Number.isFinite(config.duracaoMs) && config.duracaoMs > 0 ? config.duracaoMs : 18000;
  const alvos = [];
  const rumos = new Map();
  let ativo = false;
  let destruido = false;
  let tempo = 0;
  let rumoReal = 0;
  let ataqueAnterior = null;
  let imitacaoAtual = null;
  const rng = () => Math.max(0, Math.min(0.999999, Number((encontro.rng ?? Math.random)()) || 0));
  const rapidezAtual = () => encontro.fase === 2 && tempo < (config.dispersaoMs ?? 3200)
    ? (config.velocidadeDispersao ?? 220) : velocidade;

  function gruposVivos() {
    const grupos = new Map();
    alvos.forEach((alvo, indice) => {
      if (!alvo.active) return;
      const id = Math.floor(indice / 3);
      if (!grupos.has(id)) grupos.set(id, []);
      grupos.get(id).push(alvo);
    });
    return [...grupos.values()];
  }

  function destinoCamuflagem(distanciaMinima = 0) {
    if (!ativo || !config.agrupar) return null;
    let escolhido = null, melhor = -Infinity;
    for (const grupo of gruposVivos()) {
      const centro = { x: grupo.reduce((n, a) => n + a.x, 0) / grupo.length,
        y: grupo.reduce((n, a) => n + a.y, 0) / grupo.length };
      const juntos = grupo.filter(a => Math.hypot(a.x - centro.x, a.y - centro.y) < 130).length;
      const pontos = distanciaMinima > 0 ? [centro, ...[[60, 0], [-60, 0], [0, 60], [0, -60]]
        .map(([dx, dy]) => ({ x: centro.x + dx, y: centro.y + dy }))] : [centro];
      for (const ponto of pontos) {
        const distancia = Math.hypot(encontro.x - ponto.x, encontro.y - ponto.y);
        const score = juntos * 180 - distancia;
        if (distancia >= distanciaMinima && score > melhor && destinoIlusorioValido(scene, encontro, ponto)) {
          escolhido = ponto; melhor = score;
        }
      }
    }
    return escolhido;
  }

  function seguir(entidade, ponto, delta, verdadeira = false) {
    const dx = ponto.x - entidade.x, dy = ponto.y - entidade.y;
    const distancia = Math.hypot(dx, dy);
    if (distancia < 2) return;
    mover(entidade, Math.atan2(dy, dx), Math.min(delta, distancia / rapidezAtual() * 1000), verdadeira);
  }

  function cancelar() {
    for (const alvo of alvos) alvo.destruir();
    alvos.length = 0;
    rumos.clear();
    ativo = false;
    tempo = 0;
    ataqueAnterior = null;
    imitacaoAtual = null;
  }

  function mover(entidade, angulo, delta, verdadeira = false) {
    if (!(delta > 0)) return angulo;
    // A hitbox inteira é testada a cada <=8px, inclusive em frames muito longos.
    let restante = rapidezAtual() * delta / 1000;
    while (restante > 0) {
      const passo = Math.min(8, restante);
      let aceito = false;
      for (let tentativa = 0; tentativa < 8; tentativa++) {
        const direcao = angulo + [0, 1, -1, 2, -2, 3, -3, 4][tentativa] * Math.PI / 4;
        const ponto = {
          x: entidade.x + Math.cos(direcao) * passo,
          y: entidade.y + Math.sin(direcao) * passo,
        };
        if (!destinoIlusorioValido(scene, encontro, ponto)) continue;
        if (verdadeira) sincronizarCorpoNovoBoss(encontro, ponto);
        else entidade.posicionar(ponto);
        angulo = direcao;
        aceito = true;
        break;
      }
      if (!aceito) break;
      restante -= passo;
    }
    return angulo;
  }

  function imitarAtaque(tipo) {
    if (!ativo || destruido || !["pulso", "chuva", "lasers", "tentaculos"].includes(tipo)) return false;
    imitacaoAtual = tipo;
    for (let indice = 0; indice < alvos.length; indice++) alvos[indice].imitarAtaque(tipo, indice * 25);
    return true;
  }

  const sistema = {
    get ativo() { return ativo; }, get alvos() { return alvos; },
    destinoCamuflagem,
    get preparacaoMs() { return ativo && encontro.fase === 2 ? (config.dispersaoMs ?? 3200) : 0; },
    iniciar() {
      if (destruido || !config.ativo || ativo || encontro.teleporte ||
          !encontroIlusorioVisivel(scene, encontro) || !scene.add?.sprite ||
          !destinoIlusorioValido(scene, encontro, encontro.sprite, true)) return false;
      encontro.sistemaIlusoes?.encerrarQuatro();
      const origem = { x: encontro.sprite.x, y: encontro.sprite.y };
      const variacao = rng() * Math.PI * 2;
      const lugarReal = Math.floor(rng() * (quantidade + 1));
      for (let indice = 0; indice < quantidade; indice++) {
        const alvo = criarAlvoIlusorio(scene, encontro, origem, `movel-${indice + 1}`, "clone");
        alvo.sprite.setAlpha(1);
        alvos.push(alvo);
        const lugar = indice >= lugarReal ? indice + 1 : indice;
        rumos.set(alvo, variacao + lugar / (quantidade + 1) * Math.PI * 2);
      }
      rumoReal = variacao + lugarReal / (quantidade + 1) * Math.PI * 2;
      ativo = true;
      tempo = 0;
      ataqueAnterior = encontro.ataqueAtual ?? null;
      scene.events?.emit("novo-boss:clones-iniciados", { encontro, quantidade });
      return true;
    },
    imitarAtaque,
    atualizar(delta = 0) {
      if (destruido) return;
      if (!encontroIlusorioVisivel(scene, encontro)) { cancelar(); return; }
      if (!ativo || !Number.isFinite(delta) || delta < 0) return;
      const passo = Math.min(delta, Math.max(0, duracaoMs - tempo));
      tempo += passo;
      const ataque = encontro.ataqueAtual ?? null;
      if (ataque && ataque !== ataqueAnterior) {
        const nome = { pulsoRepulsao: "pulso", chuvaRaios: "chuva", lasersEspiral: "lasers" }[ataque.tipo] ?? ataque.tipo;
        imitarAtaque(nome);
      }
      ataqueAnterior = ataque;
      const grupos = config.agrupar && encontro.fase === 2 ? gruposVivos() : [];
      for (const alvo of alvos) {
        if (!alvo.active) continue;
        if (encontro.fase === 2 && encontro.config.fase2?.movimento?.ativo) {
          const tempoMovel = tempoMovimentoNovoBoss(scene, encontro, passo);
          const grupo = grupos.find(g => g.includes(alvo));
          const lider = grupo?.[0];
          if (lider && lider !== alvo) {
            const ordem = grupo.indexOf(alvo), rumo = rumos.get(lider) + (ordem === 1 ? 2.3 : -2.3);
            const ponto = { x: lider.x + Math.cos(rumo) * 56, y: lider.y + Math.sin(rumo) * 40 };
            seguir(alvo, destinoIlusorioValido(scene, encontro, ponto) ? ponto : lider, tempoMovel);
          } else rumos.set(alvo, mover(alvo, rumos.get(alvo), tempoMovel));
        } else rumos.set(alvo, mover(alvo, rumos.get(alvo), passo));
        alvo.atualizarVisual(passo);
      }
      if (tempo >= duracaoMs) cancelar();
    },
    /** Etapa 6 controla quando a verdadeira deve se mover entre os clones. */
    moverVerdadeira(delta = 0) {
      if (!ativo || destruido || encontro.teleporte || encontro.apresentacao?.recuouNesteQuadro ||
          !encontroIlusorioVisivel(scene, encontro) ||
          !Number.isFinite(delta) || delta <= 0) return false;
      const antes = { x: encontro.sprite.x, y: encontro.sprite.y };
      const passo = encontro.fase === 2 && encontro.config.fase2?.movimento?.ativo
        ? tempoMovimentoNovoBoss(scene, encontro, delta) : Math.min(delta, duracaoMs);
      const grupo = encontro.fase === 2 ? destinoCamuflagem() : null;
      if (grupo) seguir(encontro.sprite, grupo, passo, true);
      else rumoReal = mover(encontro.sprite, rumoReal, passo, true);
      return encontro.sprite.x !== antes.x || encontro.sprite.y !== antes.y;
    },
    cancelar,
    destruir() { if (!destruido) { cancelar(); destruido = true; } },
    snapshot() {
      return { ativo, destruido, tempo, duracaoMs, quantidade,
        velocidade: encontro.fase === 2 && tempo < (config.dispersaoMs ?? 3200)
          ? (config.velocidadeDispersao ?? 220) : velocidade,
        preparacaoMs: sistema.preparacaoMs,
        imitacaoAtual, alvos: alvos.map(alvo => alvo.snapshot()) };
    },
  };
  return sistema;
}
