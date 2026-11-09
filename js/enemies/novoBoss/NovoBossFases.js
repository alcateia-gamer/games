/** Transição única e ondas recorrentes, sem proteção extra contra dano. */
import { jogadorNaArenaNovoBoss } from "./NovoBossConfig.js";
import { destinoValidoNovoBoss, iniciarTeleporteNovoBoss, sincronizarCorpoNovoBoss } from "./NovoBossTeleporte.js";
import { atualizarMovimentoNovoBoss } from "./NovoBossMovimento.js";

const MOTIVO_CLONES = "clones-centro";
const numero = (valor, padrao) => Number.isFinite(valor) && valor >= 0 ? valor : padrao;
const centroDoEncontro = encontro => encontro.config.teleporte.pontos.find(p => p.id === "centro") ??
  encontro.config.posicaoInicial;
const noCentro = encontro => {
  const centro = centroDoEncontro(encontro);
  return Math.hypot(encontro.sprite.x - centro.x, encontro.sprite.y - centro.y) <= 1;
};

function podeAtualizar(scene, encontro) {
  if (encontro.prologo?.bloqueiaCombatePrincipal) return false;
  return Boolean(encontro.config.fase2?.ativo && !scene.multiplayer &&
    !scene.morteEmAndamento && (scene.vida ?? 1) > 0 &&
    encontro.vida > 0 && !encontro.morto && !encontro.encerrado && !encontro.suspenso &&
    encontro.sprite?.active && encontro.jogadorNaArena &&
    jogadorNaArenaNovoBoss(scene.player, encontro.config.arena));
}

export function prepararFasesNovoBoss(scene, encontro) {
  encontro.fase = 1;
  encontro.transicaoFase2Pendente = false;
  encontro.clonesFase2Executados = false;
  encontro.clonesFase2EmCurso = false;
  encontro.ondasClonesFase2 = 0;
  encontro.inicioOndaClonesEm = null;
  encontro.proximaOndaClonesEm = Infinity;
  encontro.proximaTentativaClonesEm = 0;
  encontro.invulneravelClonesAte = 0;
  encontro.inicioFase2Em = null;

  function iniciarOnda() {
    if (!noCentro(encontro) || !destinoValidoNovoBoss(scene, encontro, centroDoEncontro(encontro))) return false;
    sincronizarCorpoNovoBoss(encontro, centroDoEncontro(encontro));
    const agora = encontro.relogioCombate;
    // Clonar não protege a verdadeira; apenas a barreira pode bloquear dano.
    encontro.inicioOndaClonesEm = agora;
    encontro.invulneravelClonesAte = 0;
    encontro.ondasClonesFase2++;
    if (!encontro.iniciarClones?.()) {
      encontro.inicioOndaClonesEm = null;
      encontro.invulneravelClonesAte = 0;
      encontro.ondasClonesFase2--;
      return false;
    }
    encontro.transicaoFase2Pendente = false;
    encontro.clonesFase2Executados = true;
    encontro.clonesFase2EmCurso = true;
    encontro.proximaOndaClonesEm = Infinity;
    encontro.estado = "preparando";
    encontro.tempoEstado = 0;
    encontro.tempoSemAproximacao = 0;
    if (encontro.teleportePendente === "preventivo") encontro.teleportePendente = null;
    return true;
  }

  encontro.tentarIniciarOndaClones = () => {
    if (!podeAtualizar(scene, encontro) || encontro.fase !== 2 || encontro.config.clones?.ativo === false ||
        encontro.sistemaClones?.ativo) return false;
    if (encontro.relogioCombate >= encontro.proximaOndaClonesEm) encontro.transicaoFase2Pendente = true;
    if (!encontro.transicaoFase2Pendente || encontro.teleporte || encontro.teleportePendente ||
        encontro.ataqueAtual || !["preparando", "posicionada"].includes(encontro.estado) ||
        encontro.relogioCombate < encontro.proximaTentativaClonesEm) return false;
    if (noCentro(encontro) && iniciarOnda()) return true;
    const centro = centroDoEncontro(encontro);
    if (!noCentro(encontro) && iniciarTeleporteNovoBoss(scene, encontro, MOTIVO_CLONES, { destino: centro })) {
      encontro.estado = "teletransportando";
      encontro.tempoEstado = 0;
      encontro.ultimoTeleporteEm = encontro.relogioCombate;
      encontro.tempoSemAproximacao = 0;
      return true;
    }
    encontro.proximaTentativaClonesEm = encontro.relogioCombate + encontro.config.teleporte.reavaliarDestinoMs;
    return false;
  };
  encontro.concluirPosicionamentoClones = resultado => {
    if (resultado.motivo !== MOTIVO_CLONES) return false;
    if (!podeAtualizar(scene, encontro) || !encontro.transicaoFase2Pendente || !iniciarOnda()) {
      encontro.proximaTentativaClonesEm = encontro.relogioCombate + encontro.config.teleporte.reavaliarDestinoMs;
    }
    // Uma recuperação fora do centro não vira um teleporte normal pendente.
    return true;
  };
  encontro.verificarFase = () => {
    if (!podeAtualizar(scene, encontro) || encontro.fase !== 1 || encontro.vida <= 0 ||
        encontro.vida >= encontro.vidaMaxima * encontro.config.fase2.limiarVida) return false;
    encontro.fase = 2;
    encontro.inicioFase2Em = encontro.relogioCombate;
    encontro.transicaoFase2Pendente = true;
    encontro.cancelarAtaque?.({ preservarTentaculos: true });
    encontro.sistemaIlusoes?.encerrarQuatro();
    scene.events?.emit("novo-boss:fase-alterada", { encontro, anterior: 1, fase: 2 });
    return true;
  };
}

export function atualizarFasesNovoBoss(scene, encontro, delta = 0) {
  if (encontro.prologo?.bloqueiaCombatePrincipal) return;
  if (!Number.isFinite(delta) || delta < 0) return;
  const atualizarFase2 = podeAtualizar(scene, encontro);
  if (atualizarFase2) encontro.verificarFase?.();
  if (encontro.fase !== 2) {
    atualizarMovimentoNovoBoss(scene, encontro, delta);
    return;
  }
  if (!atualizarFase2) return;
  encontro.tentarIniciarOndaClones?.();
  if (encontro.sistemaClones?.ativo) {
    encontro.clonesFase2EmCurso = true;
    // Pulso e espiral são anunciados e executados sem deslocar a origem central.
    if (delta > 0 && !encontro.config.fase2.movimento?.ativo && encontro.estado !== "vulneravel" &&
        !["pulsoRepulsao", "lasers"].includes(encontro.ataqueAtual?.tipo)) {
      const desdeInicio = encontro.relogioCombate - (encontro.inicioOndaClonesEm ?? -Infinity);
      encontro.sistemaClones.moverVerdadeira(Math.min(delta, Math.max(0, desdeInicio)));
    }
  } else if (encontro.clonesFase2EmCurso && !encontro.transicaoFase2Pendente) {
    encontro.clonesFase2EmCurso = false;
    encontro.invulneravelClonesAte = 0;
    encontro.proximaOndaClonesEm = encontro.relogioCombate + numero(encontro.config.fase2.intervaloOndasMs, 10000);
    // Volta a um dos pontos sem interromper o ataque nem furar a recarga.
    encontro.teleportePendente ??= "retorno-clones";
  }
  atualizarMovimentoNovoBoss(scene, encontro, delta);
}
