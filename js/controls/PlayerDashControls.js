/**
 * @file Impulso de dash com custo de estamina, recarga e rastro temporal. O movimento normal
 * consulta este módulo antes de aplicar sua velocidade.
 */

import { gastarEstamina } from "../player/PlayerStatus.js";
import { obterDirecaoMovimento } from "./PlayerMovementInput.js";
import { posicionarBotaoFixo } from "./FixedActionButton.js";

// =====================================================
// DASH SANDEVISTAN - CORES POR PERSONAGEM
// =====================================================

const CONFIG_DASH = {
  velocidade: 650,
  duracao: 180,
  recarga: 750,
  custoEstamina: 25,

  // BOTÃO
  distanciaXBotao: 90,
  distanciaYBotao: -20,
  tamanhoBotao: 86,

  opacidadeNormal: 0.75,
  opacidadeRecarga: 0.35,

  // RASTROS
  intervaloRastro: 25,
  intervaloRastroPosDash: 45,
  duracaoRastroPosDash: 300,

  // TEMPO DE VIDA
  duracaoRastro: 380,

  // OPACIDADES
  opacidadeSombra: 0.62,
  opacidadeBrilho: 0.17,

  // DISTÂNCIA ENTRE CÓPIAS
  distanciaMinimaRastro: 3,
  distanciaMinimaRastroWalk: 11,

  // OTIMIZAÇÃO MOBILE
  maximoRastros: 24,

  // FLASH
  duracaoFlash: 160,
};

// Menos cópias simultâneas no toque; mantém as cores, o flash e as duas camadas.
const PERFIL_DASH_MOBILE = {
  maximoRastros: 12,
  intervaloRastro: 40,
  intervaloRastroPosDash: 70,
};

// =====================================================
// PALETA DE CORES DE CADA PERSONAGEM
// =====================================================

const CORES_SANDEVISTAN = {
  "kai-mercer": {
    sombra: 0x2376c7,
    brilho: 0x31c8ff,
    flash: 0x00bfff,
  },

  "magnus-force": {
    sombra: 0xd96617,
    brilho: 0xffb340,
    flash: 0xff8c00,
  },

  "aria-kade": {
    sombra: 0xd94c95,
    brilho: 0xff91ce,
    flash: 0xff4da6,
  },

  nyx: {
    sombra: 0x7132b0,
    brilho: 0xb975ff,
    flash: 0x9933ff,
  },
};

// =====================================================
// IDENTIFICAR A PALETA DO PERSONAGEM
// =====================================================

/**
 * Seleciona a paleta de rastro e flash do personagem, usando Kai como configuração padrão.
 */
function obterCoresSandevistan(scene) {
  const personagem = scene.personagemSelecionada ?? "kai-mercer";

  return CORES_SANDEVISTAN[personagem] ?? CORES_SANDEVISTAN["kai-mercer"];
}

// =====================================================
// IDENTIFICAR DIREÇÃO DO DASH
// =====================================================

/**
 * Escolhe a direção normalizada pelo teclado, joystick ou última direção de movimento
 * conhecida.
 */
function obterDirecaoDash(scene) {
  const { x, y } = obterDirecaoMovimento(scene);

  if (x === 0 && y === 0) {
    return scene.ultimaDirecaoDash?.clone() ?? new Phaser.Math.Vector2(0, 1);
  }

  return new Phaser.Math.Vector2(x, y);
}

// =====================================================
// CRIAR RASTRO TEMPORAL
// =====================================================

/**
 * Cria uma cópia visual temporária do personagem, respeitando intervalo, distância mínima e
 * limite de rastros.
 */
function criarRastroTemporal(scene) {
  const player = scene.player;
  const estado = scene.estadoDash;

  if (!player?.active || !estado) {
    return;
  }

  const agora = scene.time.now;

  if (!estado.ativo && agora >= estado.fimEfeitoVisual) {
    return;
  }

  if (estado.rastros.size >= (estado.perfilVisual ?? CONFIG_DASH).maximoRastros) {
    return;
  }

  // ===================================================
  // IDENTIFICAR COR DO PERSONAGEM
  // ===================================================

  const cores = obterCoresSandevistan(scene);

  // ===================================================
  // DISTÂNCIA ENTRE SOMBRAS
  // ===================================================

  const distancia = Phaser.Math.Distance.Between(
    player.x,
    player.y,
    estado.ultimoRastroX,
    estado.ultimoRastroY,
  );

  const distanciaMinima = estado.ativo
    ? CONFIG_DASH.distanciaMinimaRastro
    : CONFIG_DASH.distanciaMinimaRastroWalk;

  if (distancia < distanciaMinima) {
    return;
  }

  // ===================================================
  // TEXTURA DO PERSONAGEM
  // ===================================================

  const textura = player.texture?.key;
  const frame = player.frame?.name;

  if (!textura || frame === undefined) {
    return;
  }

  // ===================================================
  // CONTAINER DA SOMBRA TEMPORAL
  // ===================================================

  const grupo = scene.add.container(player.x, player.y);

  grupo.setDepth(player.depth - 0.01);

  // ===================================================
  // CAMADA PRINCIPAL DA SOMBRA
  // ===================================================

  const sombra = scene.add.image(0, 0, textura, frame);

  sombra.setOrigin(player.originX, player.originY);

  sombra.setDisplaySize(player.displayWidth, player.displayHeight);

  sombra.setFlip(player.flipX, player.flipY);

  sombra.setAngle(player.angle);

  // COR EXCLUSIVA DO PERSONAGEM
  sombra.setTint(cores.sombra);

  sombra.setAlpha(CONFIG_DASH.opacidadeSombra);

  // ===================================================
  // CAMADA DE BRILHO
  // ===================================================

  const brilho = scene.add.image(0, 0, textura, frame);

  brilho.setOrigin(player.originX, player.originY);

  brilho.setDisplaySize(player.displayWidth, player.displayHeight);

  brilho.setFlip(player.flipX, player.flipY);

  brilho.setAngle(player.angle);

  // BRILHO EXCLUSIVO DO PERSONAGEM
  brilho.setTint(cores.brilho);

  brilho.setAlpha(CONFIG_DASH.opacidadeBrilho);

  brilho.setBlendMode(Phaser.BlendModes.ADD);

  // ===================================================
  // MONTAR SOMBRA COMPLETA
  // ===================================================

  grupo.add([sombra, brilho]);

  estado.rastros.add(grupo);

  estado.ultimoRastroX = player.x;
  estado.ultimoRastroY = player.y;

  // ===================================================
  // DESAPARECIMENTO SUAVE
  // ===================================================

  scene.tweens.add({
    targets: grupo,

    alpha: 0,

    duration: CONFIG_DASH.duracaoRastro,

    ease: "Sine.easeIn",

    onComplete: () => {
      estado.rastros.delete(grupo);

      if (grupo.active) {
        grupo.destroy();
      }
    },
  });
}

// =====================================================
// FLASH DE ATIVAÇÃO DO DASH
// =====================================================

/**
 * Desenha o flash de ativação na cor do personagem e remove o efeito ao terminar a expansão.
 */
function criarFlashDash(scene) {
  const player = scene.player;
  const estado = scene.estadoDash;

  if (!player?.active || !estado) {
    return;
  }

  // O FLASH USA A COR DO PERSONAGEM
  const cores = obterCoresSandevistan(scene);

  const flash = scene.add.circle(player.x, player.y, 15, cores.flash, 0.1);

  flash.setStrokeStyle(2, cores.flash, 0.55);

  flash.setDepth(player.depth - 0.02);

  estado.efeitos.add(flash);

  scene.tweens.add({
    targets: flash,

    scaleX: 2,
    scaleY: 2,
    alpha: 0,

    duration: CONFIG_DASH.duracaoFlash,

    ease: "Sine.easeOut",

    onComplete: () => {
      estado.efeitos.delete(flash);

      if (flash.active) {
        flash.destroy();
      }
    },
  });
}

// =====================================================
// ATIVAR DASH
// =====================================================

/**
 * Valida movimento, recarga e estamina antes de aplicar o impulso e iniciar os efeitos do
 * dash.
 */
function iniciarDash(scene) {
  const estado = scene.estadoDash;
  const player = scene.player;

  if (scene.movimentoBloqueado || !estado || !player?.active || !player.body) {
    return false;
  }

  const agora = scene.time.now;

  // PRESERVA O RECUO DE DANO
  if (!scene.multiplayer && player.combatKnockbackUntil > agora) {
    return false;
  }

  // IMPEDE DASH DUPLO
  if (estado.ativo) {
    return false;
  }

  // COOLDOWN
  if (agora < estado.proximoDash) {
    return false;
  }

  // NÃO INTERROMPER ATAQUE
  if (scene.atacando) {
    return false;
  }

  // ===================================================
  // CONSUMIR STAMINA
  // ===================================================

  if (
    typeof scene.estamina !== "number" ||
    !gastarEstamina(scene, CONFIG_DASH.custoEstamina)
  ) {
    if (scene.botaoDash?.active) {
      scene.botaoDash.setAlpha(0.2);
    }

    return false;
  }

  // ===================================================
  // DEFINIR DIREÇÃO
  // ===================================================

  const direcao = obterDirecaoDash(scene);

  estado.ativo = true;
  estado.direcao.copy(direcao);

  // ===================================================
  // DEFINIR TEMPOS
  // ===================================================

  estado.fim = agora + CONFIG_DASH.duracao;

  estado.fimEfeitoVisual = estado.fim + CONFIG_DASH.duracaoRastroPosDash;

  estado.proximoDash = agora + CONFIG_DASH.recarga;

  estado.proximoRastro = agora;

  // PERMITE A PRIMEIRA SOMBRA
  estado.ultimoRastroX = Infinity;
  estado.ultimoRastroY = Infinity;

  // ===================================================
  // IMPULSO
  // ===================================================

  player.setVelocity(
    direcao.x * CONFIG_DASH.velocidade,
    direcao.y * CONFIG_DASH.velocidade,
  );

  // ===================================================
  // EFEITOS DO SANDEVISTAN
  // ===================================================

  criarFlashDash(scene);
  criarRastroTemporal(scene);

  estado.proximoRastro = agora + (estado.perfilVisual ?? CONFIG_DASH).intervaloRastro;

  // ===================================================
  // BOTÃO EM RECARGA
  // ===================================================

  if (scene.botaoDash?.active) {
    scene.botaoDash.setAlpha(CONFIG_DASH.opacidadeRecarga);
  }

  return true;
}

// =====================================================
// ATUALIZAR DASH E EFEITOS
// =====================================================

/**
 * Atualiza recarga, impulso e rastros; retorna se o dash ainda controla a velocidade do
 * jogador.
 */
function atualizarDash(scene) {
  const estado = scene.estadoDash;
  const player = scene.player;

  if (!estado || !player?.active) {
    return false;
  }

  const agora = scene.time.now;

  // ===================================================
  // ATUALIZAR OPACIDADE DO BOTÃO
  // ===================================================

  if (scene.botaoDash?.active) {
    const pronto =
      !estado.ativo &&
      agora >= estado.proximoDash &&
      scene.estamina >= CONFIG_DASH.custoEstamina;

    scene.botaoDash.setAlpha(
      pronto ? CONFIG_DASH.opacidadeNormal : CONFIG_DASH.opacidadeRecarga,
    );
  }

  // ===================================================
  // FINALIZAR IMPULSO
  // ===================================================

  if (estado.ativo && agora >= estado.fim) {
    // Finaliza somente o movimento especial.
    estado.ativo = false;

    // Mantém a transição para o walk sem lacunas.
    criarRastroTemporal(scene);

    estado.proximoRastro = agora;
  }

  // ===================================================
  // RASTROS DURANTE DASH E WALK
  // ===================================================

  const efeitoVisualAtivo = estado.ativo || agora < estado.fimEfeitoVisual;

  if (efeitoVisualAtivo && agora >= estado.proximoRastro) {
    criarRastroTemporal(scene);

    const perfil = estado.perfilVisual ?? CONFIG_DASH;
    const intervalo = estado.ativo
      ? perfil.intervaloRastro
      : perfil.intervaloRastroPosDash;

    estado.proximoRastro = agora + intervalo;
  }

  // ===================================================
  // RETORNAR AO MOVIMENTO NORMAL
  // ===================================================

  if (!estado.ativo) {
    return false;
  }

  // ===================================================
  // MANTER VELOCIDADE DO DASH
  // ===================================================

  player.setVelocity(
    estado.direcao.x * CONFIG_DASH.velocidade,
    estado.direcao.y * CONFIG_DASH.velocidade,
  );

  return true;
}

// =====================================================
// CRIAR CONTROLES
// =====================================================

/**
 * Cria o estado do dash, o botão e os atalhos Q e F, além da limpeza ao trocar de cena.
 */
function criarControlesDash(scene) {
  scene.limparControlesDash?.();

  scene.estadoDash = {
    ativo: false,
    perfilVisual: scene.sys?.game?.device?.input?.touch ? PERFIL_DASH_MOBILE : CONFIG_DASH,

    direcao: new Phaser.Math.Vector2(0, 1),

    fim: 0,
    fimEfeitoVisual: 0,

    proximoDash: 0,
    proximoRastro: 0,

    ultimoRastroX: Infinity,
    ultimoRastroY: Infinity,

    rastros: new Set(),
    efeitos: new Set(),
  };

  scene.ultimaDirecaoDash = new Phaser.Math.Vector2(0, 1);

  const ataque = scene.botaoAtaque;

  if (!ataque) {
    console.warn("Dash: botão de ataque não encontrado.");
    return;
  }

  // ===================================================
  // POSIÇÃO DO BOTÃO
  // ===================================================

  const x = 720 - CONFIG_DASH.distanciaXBotao;

  const y = 350 - CONFIG_DASH.distanciaYBotao;

  // ===================================================
  // CARREGAR SPRITE DO BOTÃO
  // ===================================================

  if (scene.textures.exists("botao-dash")) {
    scene.botaoDash = scene.add.image(x, y, "botao-dash");

    scene.botaoDash.setDisplaySize(
      CONFIG_DASH.tamanhoBotao,
      CONFIG_DASH.tamanhoBotao,
    );
  } else {
    scene.botaoDash = scene.add.circle(
      x,
      y,
      CONFIG_DASH.tamanhoBotao / 2,
      0x17374c,
      0.95,
    );

    scene.botaoDash.setStrokeStyle(3, 0x00d9ff);
  }

  // ===================================================
  // CONFIGURAÇÃO VISUAL
  // ===================================================

  scene.botaoDash
    .setScrollFactor(0)
    .setDepth(110)
    .setAlpha(CONFIG_DASH.opacidadeNormal)
    .setInteractive({ useHandCursor: true });

  // ===================================================
  // BOTÃO MOBILE / MOUSE
  // ===================================================

  scene.botaoDash.on("pointerdown", (pointer) => {
    pointer.event?.preventDefault?.();
    iniciarDash(scene);
  });

  const escalaX = scene.botaoDash.scaleX;
  const escalaY = scene.botaoDash.scaleY;
  const atualizarPosicaoDash = () => {
    posicionarBotaoFixo(scene.cameras.main, scene.botaoDash, x, y, escalaX, escalaY);
  };
  scene.events.on("prerender", atualizarPosicaoDash);
  atualizarPosicaoDash();

  // ===================================================
  // ATALHOS TECLADO Q E F
  // ===================================================

  const teclaQ = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
  const teclaF = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F);

  /**
   * Encaminha os atalhos de teclado para a mesma ação usada pelo botão de dash.
   */
  const pressionarDash = () => iniciarDash(scene);

  teclaQ?.on("down", pressionarDash);
  teclaF?.on("down", pressionarDash);

  // ===================================================
  // LIMPEZA AO TROCAR DE CENA
  // ===================================================

  /**
   * Remove teclas, rastros, flashes, animações e referências do dash ao encerrar ou recriar os
   * controles.
   */
  const limpar = () => {
    scene.events.off("prerender", atualizarPosicaoDash);
    teclaQ?.off("down", pressionarDash);
    teclaF?.off("down", pressionarDash);

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);

    const estado = scene.estadoDash;

    if (estado) {
      // REMOVER RASTROS
      for (const objeto of estado.rastros) {
        scene.tweens.killTweensOf(objeto);
        objeto.destroy();
      }

      // REMOVER FLASHES
      for (const objeto of estado.efeitos) {
        scene.tweens.killTweensOf(objeto);
        objeto.destroy();
      }

      estado.rastros.clear();
      estado.efeitos.clear();
    }

    // REMOVER BOTÃO
    if (scene.botaoDash?.active) {
      scene.botaoDash.destroy();
    }

    scene.botaoDash = null;
    scene.estadoDash = null;

    if (scene.limparControlesDash === limpar) {
      scene.limparControlesDash = null;
    }
  };

  scene.limparControlesDash = limpar;

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limpar);
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

export {
  CONFIG_DASH,
  CORES_SANDEVISTAN,
  obterCoresSandevistan,
  criarControlesDash,
  atualizarDash,
  iniciarDash,
};
