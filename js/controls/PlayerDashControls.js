const CONFIG_DASH = {
  velocidade: 650,
  duracao: 180,
  recarga: 800,

  // Distância em relação ao botão de ataque.
  distanciaXBotao: 90,
  distanciaYBotao: -30,

  tamanhoBotao: 86,
};

// =====================================================
// IDENTIFICAR DIREÇÃO DO DASH
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
// ATIVAR DASH
// =====================================================

function iniciarDash(scene) {
  const estado = scene.estadoDash;

  if (!estado || !scene.player?.active || !scene.player.body) {
    return false;
  }

  const agora = scene.time.now;

  // Evita repetir enquanto estiver ativo ou em recarga.
  if (estado.ativo || agora < estado.proximoDash) {
    return false;
  }

  // Não interrompe animações de ataque.
  if (scene.atacando) {
    return false;
  }

  const direcao = obterDirecaoDash(scene);

  estado.ativo = true;
  estado.direcao.copy(direcao);

  estado.fim = agora + CONFIG_DASH.duracao;
  estado.proximoDash = agora + CONFIG_DASH.recarga;

  scene.player.setVelocity(
    direcao.x * CONFIG_DASH.velocidade,
    direcao.y * CONFIG_DASH.velocidade,
  );

  if (scene.botaoDash?.active) {
    scene.botaoDash.setAlpha(0.45);
  }

  return true;
}

// =====================================================
// ATUALIZAR DASH
// =====================================================

function atualizarDash(scene) {
  const estado = scene.estadoDash;

  if (!estado || !scene.player?.active) {
    return false;
  }

  const agora = scene.time.now;

  // Atualiza a transparência durante a recarga.
  if (scene.botaoDash?.active) {
    scene.botaoDash.setAlpha(agora >= estado.proximoDash ? 0.75 : 0.35);
  }

  if (!estado.ativo) {
    return false;
  }

  // Fim do impulso.
  if (agora >= estado.fim) {
    estado.ativo = false;

    return false;
  }

  // Impulso na direção escolhida.
  // Mantém o corpo Arcade e colisões originais.
  scene.player.setVelocity(
    estado.direcao.x * CONFIG_DASH.velocidade,
    estado.direcao.y * CONFIG_DASH.velocidade,
  );

  return true;
}

// =====================================================
// CRIAR BOTÃO
// =====================================================

function criarControlesDash(scene) {
  scene.limparControlesDash?.();

  scene.estadoDash = {
    ativo: false,
    direcao: new Phaser.Math.Vector2(0, 1),
    fim: 0,
    proximoDash: 0,
  };

  scene.ultimaDirecaoDash = new Phaser.Math.Vector2(0, 1);

  const ataque = scene.botaoAtaque;

  if (!ataque) {
    console.warn("Dash: botão de ataque não foi encontrado.");
    return;
  }

  // DIAGONAL SUPERIOR ESQUERDA DO ATAQUE
  const x = ataque.x - CONFIG_DASH.distanciaXBotao;
  const y = ataque.y - CONFIG_DASH.distanciaYBotao;

  if (scene.textures.exists("botao-dash")) {
    scene.botaoDash = scene.add.image(x, y, "botao-dash");

    scene.botaoDash.setDisplaySize(
      CONFIG_DASH.tamanhoBotao,
      CONFIG_DASH.tamanhoBotao,
    );
  } else {
    // Botão alternativo se o PNG não carregar.
    scene.botaoDash = scene.add.circle(x, y, 38, 0x17374c, 0.95);

    scene.botaoDash.setStrokeStyle(3, 0x00d9ff);
  }

  scene.botaoDash
    .setScrollFactor(0)
    .setDepth(110)
    .setAlpha(0.75)
    .setInteractive({ useHandCursor: true });

  // TOQUE MOBILE E CLIQUE COM MOUSE
  scene.botaoDash.on("pointerdown", (pointer) => {
    pointer.event?.preventDefault?.();

    iniciarDash(scene);
  });

  // ATALHO NO TECLADO: Q
  const teclaQ = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

  const pressionarQ = () => iniciarDash(scene);

  teclaQ?.on("down", pressionarQ);

  // =====================================================
  // LIMPEZA AO TROCAR DE CENA
  // =====================================================

  const limpar = () => {
    teclaQ?.off("down", pressionarQ);

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);

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
