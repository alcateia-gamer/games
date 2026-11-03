/** Um ataque ofensivo por vez; cada execução tem seus próprios recursos. */
import { definicaoAtaqueNovoBoss } from "./NovoBossFabricaAtaques.js";
import { criarServicosAtaques } from "./NovoBossServicosAtaques.js";
import { liberarJogadorNovoBoss } from "../../player/PlayerControlEffects.js";
import { destinoValidoNovoBoss, iniciarTeleporteNovoBoss } from "./NovoBossTeleporte.js";

const MOTIVO_CENTRAL = "ataque-central";
const noPonto = (sprite, ponto) => Math.hypot(sprite.x - ponto.x, sprite.y - ponto.y) <= 1;

function prepararAtaqueCentral(scene, encontro, tipo) {
  const centro = encontro.config.teleporte.pontos.find(p => p.id === "centro") ?? encontro.config.posicaoInicial;
  if (noPonto(encontro.sprite, centro)) return "pronto";
  const origem = { x: encontro.x, y: encontro.y };
  if (!iniciarTeleporteNovoBoss(scene, encontro, MOTIVO_CENTRAL,
    { destino: centro, preservarIlusoes: true })) return "bloqueado";
  encontro.ataquePendente = { tipo, centro, origem };
  encontro.estado = "teletransportando";
  encontro.tempoEstado = 0;
  encontro.ultimoTeleporteEm = encontro.relogioCombate;
  encontro.tempoSemAproximacao = 0;
  encontro.teleportePendente = null;
  return "aguardando";
}

export function prepararAtaquesNovoBoss(scene, encontro) {
  encontro.projeteisBoss = [];
  encontro.indiceAtaque = 0;
  encontro.ataqueAtual = null;
  encontro.ataquePendente = null;
  encontro.concluirPosicionamentoAtaque = (resultado, origemViagem) => {
    if (resultado.motivo !== MOTIVO_CENTRAL) return false;
    const pedido = encontro.ataquePendente;
    encontro.ataquePendente = null;
    encontro.sistemaIlusoes?.trocarFalsaNoDestino(encontro.sprite, pedido?.origem ?? origemViagem);
    if (!pedido) return true;
    // A recuperação do teleporte pode ter escolhido outro ponto por segurança.
    // Nesse caso abandona o ataque, sem disparar de um lugar diferente.
    if (noPonto(encontro.sprite, pedido.centro) && destinoValidoNovoBoss(scene, encontro, pedido.centro)) {
      encontro.executarAtaque(pedido.tipo);
    }
    return true;
  };
  encontro.executarAtaque = tipo => executarAtaqueNovoBoss(scene, encontro, tipo);
  encontro.cancelarAtaque = () => cancelarAtaqueNovoBoss(scene, encontro);
  encontro.iniciarAtaqueAutomatico = () => {
    if (encontro.tentarIniciarOndaClones?.()) return true;
    if (!encontro.config.ataques?.ativo || encontro.config.ataques.automatico === false) return false;
    const sequencia = encontro.config.ataques.sequencia;
    const previsto = sequencia[encontro.indiceAtaque++ % sequencia.length];
    let tipo = previsto;
    if (Math.hypot(scene.player.x - encontro.x, scene.player.y - encontro.y) < 155 &&
        encontro.ultimoAtaque !== "pulso") tipo = "pulso";
    if (encontro.executarAtaque(tipo)) return true;
    // Um jogador sobre o centro não pode bloquear todos os outros ataques.
    return tipo !== previsto && encontro.executarAtaque(previsto);
  };
  encontro.avancarAtaque = delta => {
    const ataque = encontro.ataqueAtual;
    if (!ataque) return { consumido: 0, terminou: true };
    const consumido = Math.min(Math.max(0, delta), Math.max(0, ataque.duracao - encontro.tempoAtaque));
    encontro.tempoAtaque += consumido;
    const terminou = ataque.atualizar(consumido) || encontro.tempoAtaque >= ataque.duracao;
    for (const alvo of encontro.alvosIlusorios ?? []) alvo.ataquesIlusorios?.avancar(consumido);
    if (terminou) {
      ataque.destruir();
      for (const alvo of encontro.alvosIlusorios ?? []) alvo.ataquesIlusorios?.encerrar();
      encontro.ataqueAtual = null;
      scene.events.emit("novo-boss:ataque-concluido", { encontro, tipo: ataque.tipo });
    }
    return { consumido, terminou };
  };
}

export function executarAtaqueNovoBoss(scene, encontro, tipo) {
  const comIlusoes = tipo === "ilusoes";
  if (comIlusoes) tipo = "tentaculos";
  const def = definicaoAtaqueNovoBoss(tipo);
  if (!def || !encontro.config.ataques?.ativo || encontro.ataqueAtual || encontro.ataquePendente || encontro.teleporte ||
      encontro.morto || encontro.encerrado || encontro.suspenso || !encontro.sprite ||
      !encontro.jogadorNaArena || scene.multiplayer || scene.morteEmAndamento) return false;
  if ((tipo === "pulso" || tipo === "lasers") && encontro.config.ataques[def[1]].centralizar !== false) {
    const preparacao = prepararAtaqueCentral(scene, encontro, tipo);
    if (preparacao !== "pronto") return preparacao === "aguardando";
  }
  if (comIlusoes) encontro.iniciarIlusoes?.();
  encontro.tempoAtaque = 0;
  const sorteios = [];
  const servicos = criarServicosAtaques(scene, encontro);
  const rng = servicos.rng;
  servicos.rng = () => { const valor = rng(); sorteios.push(valor); return valor; };
  encontro.ataqueAtual = def[0](scene, encontro, encontro.config.ataques[def[1]], servicos);
  encontro.ultimoAtaque = tipo;
  encontro.estado = "atacando";
  encontro.tempoEstado = 0;
  for (const alvo of encontro.alvosIlusorios ?? []) {
    alvo.ataquesIlusorios?.iniciar(tipo, encontro.ataqueAtual, sorteios);
  }
  scene.events.emit("novo-boss:ataque-iniciado", { encontro, tipo });
  return true;
}

export function cancelarAtaqueNovoBoss(scene, encontro) {
  encontro.ataquePendente = null;
  for (const alvo of encontro.alvosIlusorios ?? []) alvo.ataquesIlusorios?.cancelar();
  encontro.ataqueAtual?.destruir();
  encontro.ataqueAtual = null;
  encontro.apresentacao?.limparExplosoesPulso();
  liberarJogadorNovoBoss(scene);
  if (encontro.estado === "atacando") {
    encontro.estado = "preparando";
    encontro.tempoEstado = 0;
  }
}
