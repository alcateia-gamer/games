import { gastarEstamina } from "../player/PlayerStatus.js";

// =====================================================
// DASH SANDEVISTAN - SOMBRA TEMPORAL
// =====================================================

const CONFIG_DASH = {
  velocidade: 650,
  duracao: 180,
  recarga: 1500,
  custoEstamina: 25,

  // Botão - mantém sua configuração
  distanciaXBotao: 90,
  distanciaYBotao: -30,
  tamanhoBotao: 86,

  opacidadeNormal: 0.75,
  opacidadeRecarga: 0.35,

  // Rastros
  intervaloRastro: 25,
  intervaloRastroPosDash: 45,
  duracaoRastroPosDash: 300,

  // Tempo de vida de cada sombra
  duracaoRastro: 380,

  // Cores e opacidade
  corSombra: 0x276b8d,
  corBrilho: 0x28dfff,
  opacidadeSombra: 0.62,
  opacidadeBrilho: 0.17,

  // Evita cópias sobrepostas no mesmo lugar
  distanciaMinimaRastro: 3,
  distanciaMinimaRastroWalk: 11,

  // Limite de segurança para mobile
  maximoRastros: 24,

  // Flash inicial
  corFlash: 0x00e5ff,
  duracaoFlash: 160,
};

// =====================================================
// DIREÇÃO DO DASH
// =====================================================

function obterDirecaoDash(scene) {
  let x = 0;
  let y = 0;

  const teclas = scene.teclasWASD;

  if (teclas?.esquerda?.isDown) x--;
  if (teclas?.direita?.isDown) x++;
  if (teclas?.cima?.isDown) y--;
  if (teclas?.baixo?.isDown) y++;

  if (x === 0 && y === 0 && scene.joystick) {
    if (scene.joystick.force > (scene.threshold ?? 0.1)) {
      const angulo = Phaser.Math.DegToRad(scene.joystick.angle);

      x = Math.cos(angulo);
      y = Math.sin(angulo);
    }
  }

  if (x === 0 && y === 0) {
    return scene.ultimaDirecaoDash?.clone() ?? new Phaser.Math.Vector2(0, 1);
  }

  return new Phaser.Math.Vector2(x, y).normalize();
}

// =====================================================
// CRIAR SOMBRA TEMPORAL
// =====================================================

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

  if (estado.rastros.size >= CONFIG_DASH.maximoRastros) {
    return;
  }

  // Evita gerar sombras repetidas no mesmo ponto.
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

  const textura = player.texture?.key;
  const frame = player.frame?.name;

  if (!textura || frame === undefined) {
    return;
  }

  // ===================================================
  // CONTAINER QUE MANTÉ A CÓPIA PARADA NO MUNDO
  // ===================================================

  const grupo = scene.add.container(player.x, player.y);

  grupo.setDepth(player.depth - 0.01);

  // ===================================================
  // SOMBRA PRINCIPAL
  // ===================================================

  const sombra = scene.add.image(0, 0, textura, frame);

  sombra.setOrigin(player.originX, player.originY);

  sombra.setDisplaySize(player.displayWidth, player.displayHeight);

  sombra.setFlip(player.flipX, player.flipY);

  sombra.setAngle(player.angle);

  sombra.setTint(CONFIG_DASH.corSombra);

  sombra.setAlpha(CONFIG_DASH.opacidadeSombra);

  // ===================================================
  // CAMADA SUTIL DE ENERGIA CIANO
  // ===================================================

  const brilho = scene.add.image(0, 0, textura, frame);

  brilho.setOrigin(player.originX, player.originY);

  brilho.setDisplaySize(player.displayWidth, player.displayHeight);

  brilho.setFlip(player.flipX, player.flipY);

  brilho.setAngle(player.angle);

  brilho.setTint(CONFIG_DASH.corBrilho);

  brilho.setAlpha(CONFIG_DASH.opacidadeBrilho);

  brilho.setBlendMode(Phaser.BlendModes.ADD);

  // Preserva a ordem das duas camadas.
  grupo.add([sombra, brilho]);

  // A cópia continua fixa na posição onde nasceu.
  estado.rastros.add(grupo);

  estado.ultimoRastroX = player.x;
  estado.ultimoRastroY = player.y;

  // ===================================================
  // DESAPARECIMENTO SUAVE
  // ===================================================

  // A sombra começa visível e desaparece
  // continuamente, sem uma pausa longa.
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
// FLASH DE ATIVAÇÃO
// =====================================================

function criarFlashDash(scene) {
  const player = scene.player;
  const estado = scene.estadoDash;

  if (!player?.active || !estado) {
    return;
  }

  const flash = scene.add.circle(
    player.x,
    player.y,
    15,
    CONFIG_DASH.corFlash,
    0.1,
  );

  flash.setStrokeStyle(2, CONFIG_DASH.corFlash, 0.55);

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

function iniciarDash(scene) {
  const estado = scene.estadoDash;
  const player = scene.player;

  if (!estado || !player?.active || !player.body) {
    return false;
  }

  const agora = scene.time.now;

  if (estado.ativo) {
    return false;
  }

  if (agora < estado.proximoDash) {
    return false;
  }

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
  // DEFINIR DIREÇÃO E TEMPOS
  // ===================================================

  const direcao = obterDirecaoDash(scene);

  estado.ativo = true;
  estado.direcao.copy(direcao);

  estado.fim = agora + CONFIG_DASH.duracao;

  estado.fimEfeitoVisual = estado.fim + CONFIG_DASH.duracaoRastroPosDash;

  estado.proximoDash = agora + CONFIG_DASH.recarga;

  estado.proximoRastro = agora;

  // Permite a primeira sombra imediatamente.
  estado.ultimoRastroX = Infinity;
  estado.ultimoRastroY = Infinity;

  // ===================================================
  // IMPULSO
  // ===================================================

  player.setVelocity(
    direcao.x * CONFIG_DASH.velocidade,
    direcao.y * CONFIG_DASH.velocidade,
  );

  criarFlashDash(scene);
  criarRastroTemporal(scene);

  estado.proximoRastro = agora + CONFIG_DASH.intervaloRastro;

  if (scene.botaoDash?.active) {
    scene.botaoDash.setAlpha(CONFIG_DASH.opacidadeRecarga);
  }

  return true;
}

// =====================================================
// ATUALIZAR DASH E EFEITOS VISUAIS
// =====================================================

function atualizarDash(scene) {
  const estado = scene.estadoDash;
  const player = scene.player;

  if (!estado || !player?.active) {
    return false;
  }

  const agora = scene.time.now;

  // ===================================================
  // ESTADO DO BOTÃO
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
  // TERMINAR IMPULSO
  // ===================================================

 if (estado.ativo && agora >= estado.fim) {
   // Encerra somente o impulso físico.
   estado.ativo = false;

   // Gera uma sombra exatamente no final do dash.
   criarRastroTemporal(scene);

   // Reinicia o intervalo de geração para
   // iniciar imediatamente a sequência de caminhada.
   estado.proximoRastro = agora;
 }

  // ===================================================
  // GERAR SOMBRAS DE FORMA CONTÍNUA
  // ===================================================

  const efeitoVisualAtivo = estado.ativo || agora < estado.fimEfeitoVisual;

  if (efeitoVisualAtivo && agora >= estado.proximoRastro) {
    criarRastroTemporal(scene);

    const intervalo = estado.ativo
      ? CONFIG_DASH.intervaloRastro
      : CONFIG_DASH.intervaloRastroPosDash;

    estado.proximoRastro = agora + intervalo;
  }

  // ===================================================
  // DEVOLVER CONTROLE AO MOVIMENTO NORMAL
  // ===================================================

  if (!estado.ativo) {
    return false;
  }

  // Mantém o dash independente do WASD/joystick
  // enquanto o impulso ainda estiver acontecendo.
  player.setVelocity(
    estado.direcao.x * CONFIG_DASH.velocidade,
    estado.direcao.y * CONFIG_DASH.velocidade,
  );

  return true;
}

// =====================================================
// CRIAR CONTROLES
// =====================================================

function criarControlesDash(scene) {
  scene.limparControlesDash?.();

  scene.estadoDash = {
    ativo: false,

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

  const x = ataque.x - CONFIG_DASH.distanciaXBotao;

  const y = ataque.y - CONFIG_DASH.distanciaYBotao;

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

  scene.botaoDash
    .setScrollFactor(0)
    .setDepth(110)
    .setAlpha(CONFIG_DASH.opacidadeNormal)
    .setInteractive({ useHandCursor: true });

  // ===================================================
  // MOBILE E MOUSE
  // ===================================================

  scene.botaoDash.on("pointerdown", (pointer) => {
    pointer.event?.preventDefault?.();
    iniciarDash(scene);
  });

  // ===================================================
  // TECLA Q
  // ===================================================

  const teclaQ = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

  const pressionarQ = () => iniciarDash(scene);

  teclaQ?.on("down", pressionarQ);

  // ===================================================
  // LIMPEZA DOS EFEITOS
  // ===================================================

  const limpar = () => {
    teclaQ?.off("down", pressionarQ);

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);

    const estado = scene.estadoDash;

    if (estado) {
      for (const objeto of estado.rastros) {
        scene.tweens.killTweensOf(objeto);
        objeto.destroy();
      }

      for (const objeto of estado.efeitos) {
        scene.tweens.killTweensOf(objeto);
        objeto.destroy();
      }

      estado.rastros.clear();
      estado.efeitos.clear();
    }

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

export { CONFIG_DASH, criarControlesDash, atualizarDash, iniciarDash };
