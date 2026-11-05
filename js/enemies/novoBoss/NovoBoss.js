import { prepararLibertacaoNovoBoss } from "./NovoBossLibertacao.js";
/**
 * @file Ciclo do encontro, vida e integração dos estados e teletransportes.
 * Cada subsistema mantém recursos e cancelamento próprios do encontro.
 */
import { calcularDepthAtor } from "../../map/ProfundidadeMapa.js";
import { prepararCameraNovoBoss } from "./NovoBossCamera.js";
import { prepararIntroducaoNovoBoss } from "./NovoBossIntroducao.js";
import { assetsNovoBoss, criarAnimacoesNovoBoss } from "./NovoBossAssets.js";
import { prepararAtaquesNovoBoss, cancelarAtaqueNovoBoss } from "./NovoBossAtaques.js";
import { atualizarRestricaoNovoBoss } from "../../player/PlayerControlEffects.js";
import { prepararGeradoresNovoBoss } from "./NovoBossGeradores.js";
import { prepararIlusoesNovoBoss } from "./NovoBossIlusoes.js";
import { prepararClonesNovoBoss } from "./NovoBossClones.js";
import { prepararFasesNovoBoss, atualizarFasesNovoBoss } from "./NovoBossFases.js";
import {
  prepararApresentacaoNovoBoss, sincronizarAnimacoesAtaqueNovoBoss,
} from "./NovoBossApresentacao.js";
import {
  inicializarCombateNovoBoss,
  atualizarCombateNovoBoss,
  causarDanoNovoBoss,
} from "./NovoBossEstados.js";
import { destinoValidoNovoBoss, sincronizarCorpoNovoBoss } from "./NovoBossTeleporte.js";
import {
  criarHudNovoBoss, atualizarHudNovoBoss, destruirHudNovoBoss,
} from "./NovoBossHud.js";
import {
  novoBossConfig,
  configurarZonasNovoBoss,
  jogadorNaArenaNovoBoss,
  areaCorpoNovoBoss,
} from "./NovoBossConfig.js";

function atualizarProfundidade(scene, encontro) {
  const sprite = encontro.sprite;
  if (!sprite?.active) return;
  const profundidade = Number.isFinite(scene.profundidadePersonagemParte2)
    ? calcularDepthAtor(scene, sprite.body.bottom, sprite)
    : encontro.config.visual.profundidade;
  sprite.setDepth(profundidade);
}

function tentarPosicionar(scene, encontro) {
  if (encontro.encerrado || encontro.sprite || scene.multiplayer ||
      scene.morteEmAndamento || (Number.isFinite(scene.vida) && scene.vida <= 0) ||
      !jogadorNaArenaNovoBoss(scene.player, encontro.config.arena)) return;

  if (!criarAnimacoesNovoBoss(scene)) {
    encontro.pendencia = "asset-idle-ausente";
    return;
  }

  const area = areaCorpoNovoBoss(encontro.config);
  if (!destinoValidoNovoBoss(scene, encontro, encontro.config.posicaoInicial)) {
    encontro.pendencia = "posicao-inicial-bloqueada";
    return;
  }

  const { posicaoInicial, visual } = encontro.config;
  const sprite = scene.physics.add.sprite(
    posicaoInicial.x, posicaoInicial.y, assetsNovoBoss.idle.chave, 0,
  );
  sprite.setOrigin(visual.origemX, visual.origemY);
  sprite.setScale(visual.escala);
  sprite.setDepth(visual.profundidade);
  sprite.setName("novo-boss");
  sprite.body.setAllowGravity(false);
  sprite.body.setImmovable(true);
  sprite.body.moves = false;
  sprite.body.setSize(visual.corpo.largura, visual.corpo.altura);
  sprite.body.setOffset(visual.corpo.x, visual.corpo.y);
  sprite.body.updateFromGameObject();
  sprite.play(assetsNovoBoss.idle.animacao);

  // O corpo não causa dano por contato nem bloqueia o jogador.
  encontro.sprite = sprite;
  encontro.hitboxDano = new Phaser.Geom.Rectangle(area.x, area.y, area.width, area.height);
  encontro.hitbox = encontro.hitboxDano;
  encontro.estado = "posicionada";
  encontro.pendencia = null;
  inicializarCombateNovoBoss(scene, encontro);
  sincronizarCorpoNovoBoss(encontro);
  prepararGeradoresNovoBoss(scene, encontro);
  encontro.sistemaIlusoes = prepararIlusoesNovoBoss(scene, encontro);
  encontro.sistemaClones = prepararClonesNovoBoss(scene, encontro);
  encontro.apresentacao = prepararApresentacaoNovoBoss(scene, encontro);
  criarHudNovoBoss(scene, encontro);
  atualizarProfundidade(scene, encontro);
}

function atualizarSuspensao(scene, encontro) {
  const sprite = encontro.sprite;
  if (!sprite) return;
  const suspender = Boolean(!encontro.jogadorNaArena || scene.multiplayer || scene.morteEmAndamento || !scene.player?.active ||
    (Number.isFinite(scene.vida) && scene.vida <= 0));
  if (suspender === encontro.suspenso) return;
  if (suspender) {
    encontro.visibilidadeAnterior = sprite.visible;
    encontro.corpoHabilitadoAnterior = sprite.body.enable;
    sprite.setVisible(false);
    sprite.body.enable = false;
    sprite.anims.pause();
  } else {
    sprite.setVisible(encontro.visibilidadeAnterior);
    sprite.body.enable = encontro.corpoHabilitadoAnterior && !encontro.morto && !encontro.teleporte;
    if (!encontro.morto) sprite.anims.resume();
  }
  encontro.suspenso = suspender;
}

/**
 * Prepara uma única entidade por visita à cena. O teste imediato também cobre
 * respawn/saves que iniciem com o jogador já dentro da arena.
 */
export function prepararNovoBoss(scene, config = scene?.novoBossConfig ?? novoBossConfig) {
  if (!scene) return null;
  if (scene.novoBoss && !scene.novoBoss.encerrado) return scene.novoBoss;
  config = configurarZonasNovoBoss(scene.map, config);

  const encontro = {
    config,
    estado: "aguardando",
    pendencia: null,
    sprite: null,
    hitbox: null,
    hitboxDano: null,
    vida: config.combate.vidaMaxima,
    vidaMaxima: config.combate.vidaMaxima,
    morto: false,
    jogadorNaArena: jogadorNaArenaNovoBoss(scene.player, config.arena),
    encerrado: false,
    suspenso: false,
    barreiraAtiva: false,
    geradores: [],
    relogioCombate: 0,
    limpar: null,
  };
  Object.defineProperties(encontro, {
    active: { get: () => !encontro.encerrado && !encontro.morto && !encontro.suspenso &&
      encontro.jogadorNaArena && !encontro.introducao?.bloqueiaCombate && Boolean(encontro.sprite?.active) },
    visible: { get: () => Boolean(encontro.sprite?.visible) },
    body: { get: () => encontro.sprite?.body },
    x: { get: () => encontro.sprite?.x ?? config.posicaoInicial.x },
    y: { get: () => encontro.sprite?.y ?? config.posicaoInicial.y },
    alvosIlusorios: { get: () => [
      ...(encontro.sistemaIlusoes?.alvos ?? []),
      ...(encontro.sistemaClones?.alvos ?? []),
    ] },
  });
  encontro.receberDano = (quantidade, regiaoAtaque = null) => {
    const acertou = causarDanoNovoBoss(scene, encontro, quantidade, regiaoAtaque);
    atualizarHudNovoBoss(scene, encontro);
    return acertou;
  };
  scene.novoBoss = encontro;
  scene.restricaoControleNovoBoss ??= null;
  encontro.cameraArena = prepararCameraNovoBoss(scene, encontro);
  encontro.introducao = prepararIntroducaoNovoBoss(scene, encontro);
  encontro.libertacao = prepararLibertacaoNovoBoss(scene, encontro);
  encontro.iniciarIlusoes = () => !encontro.teleporte && !encontro.ataqueAtual &&
    !encontro.sistemaClones?.ativo && Boolean(encontro.sistemaIlusoes?.iniciarQuatro());
  encontro.iniciarClones = () => !encontro.teleporte && !encontro.ataqueAtual &&
    Boolean(encontro.sistemaClones?.iniciar());
  prepararAtaquesNovoBoss(scene, encontro);
  prepararFasesNovoBoss(scene, encontro);
  encontro.limpar = () => destruirNovoBoss(scene);
  scene.events.once("shutdown", encontro.limpar);
  scene.events.once("destroy", encontro.limpar);
  tentarPosicionar(scene, encontro);
  return encontro;
}

/** Não prepara encontros: chamadas tardias após shutdown não recriam o boss. */
export function atualizarNovoBoss(scene, _time, _delta) {
  const encontro = scene?.novoBoss;
  if (!encontro || encontro.encerrado) return;
  encontro.jogadorNaArena = jogadorNaArenaNovoBoss(scene.player, encontro.config.arena);
  if (!encontro.jogadorNaArena || scene.multiplayer || scene.morteEmAndamento ||
      (scene.vida ?? 1) <= 0 || encontro.morto) {
    cancelarAtaqueNovoBoss(scene, encontro);
    if (!encontro.morto && encontro.fase === 2 && encontro.sistemaClones?.ativo) {
      encontro.transicaoFase2Pendente = true;
    }
    encontro.sistemaIlusoes?.encerrarQuatro();
    encontro.sistemaClones?.cancelar();
    encontro.invulneravelClonesAte = 0;
  }
  atualizarRestricaoNovoBoss(scene, _delta);
  tentarPosicionar(scene, encontro);
  atualizarSuspensao(scene, encontro);
  if (encontro.sprite && !encontro.morto && !encontro.sistemaGeradores && encontro.config.geradores?.ativo) {
    prepararGeradoresNovoBoss(scene, encontro);
  }
  if (encontro.introducao?.atualizar(_delta)) {
    encontro.sistemaGeradores?.atualizar(0);
    atualizarProfundidade(scene, encontro);
    encontro.apresentacao?.atualizar(0);
    atualizarHudNovoBoss(scene, encontro);
    return;
  }
  if (encontro.sprite && !encontro.morto) {
    const geradores = encontro.sistemaGeradores ?? prepararGeradoresNovoBoss(scene, encontro);
    if (geradores !== false) atualizarCombateNovoBoss(scene, encontro, _delta);
    geradores?.atualizar?.(_delta);
  }
  const desdeOnda = encontro.relogioCombate - (encontro.inicioOndaClonesEm ?? -Infinity);
  const deltaClones = Number.isFinite(_delta) && _delta >= 0
    ? Math.min(_delta, Math.max(0, desdeOnda)) : _delta;
  encontro.sistemaClones?.atualizar(deltaClones);
  atualizarFasesNovoBoss(scene, encontro, _delta);
  atualizarProfundidade(scene, encontro);
  encontro.apresentacao?.atualizar(_delta);
  // A pista do núcleo usa a pose e a direção já atualizadas neste quadro.
  encontro.sistemaIlusoes?.atualizar(_delta);
  sincronizarAnimacoesAtaqueNovoBoss(scene, encontro);
  encontro.cameraArena.atualizar(_delta);
  atualizarHudNovoBoss(scene, encontro);
}

/** Libera apenas os recursos desta entidade; pode ser chamada várias vezes. */
export function destruirNovoBoss(scene) {
  const encontro = scene?.novoBoss;
  if (!encontro || encontro.encerrado) return;
  encontro.encerrado = true;
  encontro.introducao?.destruir();
  encontro.cameraArena?.destruir();
  encontro.invulneravelClonesAte = 0;
  encontro.transicaoFase2Pendente = false;
  encontro.proximaOndaClonesEm = Infinity;
  cancelarAtaqueNovoBoss(scene, encontro);
  encontro.libertacao?.destruir();
  encontro.sistemaGeradores?.destruir();
  encontro.sistemaIlusoes?.destruir();
  encontro.sistemaClones?.destruir();
  encontro.apresentacao?.destruir();
  scene.events.off("shutdown", encontro.limpar);
  scene.events.off("destroy", encontro.limpar);
  destruirHudNovoBoss(encontro);
  if (encontro.sprite) {
    if (encontro.sprite.body) encontro.sprite.body.enable = false;
    encontro.sprite.destroy();
  }
  encontro.sprite = null;
  encontro.hitbox = null;
  encontro.hitboxDano = null;
  encontro.teleporte = null;
  encontro.teleportePendente = null;
  encontro.estado = "encerrada";
  encontro.limpar = null;
  if (scene.novoBoss === encontro) scene.novoBoss = null;
}
