/** Clones móveis inofensivos; a verdadeira continua sendo a entidade original. */
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
    let restante = velocidade * delta / 1000;
    while (restante > 0) {
      const passo = Math.min(8, restante);
      let aceito = false;
      for (let tentativa = 0; tentativa < 8; tentativa++) {
        const direcao = angulo + tentativa * Math.PI / 4;
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
    iniciar() {
      if (destruido || !config.ativo || ativo || encontro.teleporte ||
          !encontroIlusorioVisivel(scene, encontro) || !scene.add?.sprite ||
          !destinoIlusorioValido(scene, encontro, encontro.sprite, true)) return false;
      encontro.sistemaIlusoes?.encerrarQuatro();
      const origem = { x: encontro.sprite.x, y: encontro.sprite.y };
      const variacao = rng() * Math.PI * 2;
      for (let indice = 0; indice < quantidade; indice++) {
        const alvo = criarAlvoIlusorio(scene, encontro, origem, `movel-${indice + 1}`, "clone");
        // Nove clones + núcleo real continuam legíveis sobre as marcações no piso.
        alvo.sprite.setAlpha(0.86);
        alvos.push(alvo);
        rumos.set(alvo, variacao + indice / quantidade * Math.PI * 2);
      }
      rumoReal = variacao + Math.PI;
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
      for (const alvo of alvos) {
        if (!alvo.active) continue;
        rumos.set(alvo, mover(alvo, rumos.get(alvo), passo));
        alvo.atualizarVisual(passo);
      }
      if (tempo >= duracaoMs) cancelar();
    },
    /** Etapa 6 controla quando a verdadeira deve se mover entre os clones. */
    moverVerdadeira(delta = 0) {
      if (!ativo || destruido || encontro.teleporte || !encontroIlusorioVisivel(scene, encontro) ||
          !Number.isFinite(delta) || delta <= 0) return false;
      const antes = { x: encontro.sprite.x, y: encontro.sprite.y };
      rumoReal = mover(encontro.sprite, rumoReal, Math.min(delta, duracaoMs), true);
      return encontro.sprite.x !== antes.x || encontro.sprite.y !== antes.y;
    },
    cancelar,
    destruir() { if (!destruido) { cancelar(); destruido = true; } },
    snapshot() {
      return { ativo, destruido, tempo, duracaoMs, quantidade, velocidade,
        imitacaoAtual, alvos: alvos.map(alvo => alvo.snapshot()) };
    },
  };
  return sistema;
}
