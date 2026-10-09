// =====================================================
// FIXAR O PAINEL NA TELA, COMPENSANDO O ZOOM
// =====================================================

function configurarPainelStatusFixo(scene) {
  // Evita acumular listeners se o painel for recriado.
  scene.limparPainelStatusFixo?.();

  const elementos = [
    scene.painelStatus,
    scene.textoVida,
    scene.fundoVida,
    scene.barraVida,
    scene.bordaVida,
    scene.textoEstamina,
    scene.fundoEstamina,
    scene.barraEstamina,
    scene.bordaEstamina,
  ].map((objeto) => ({
    objeto,
    x: objeto.x,
    y: objeto.y,
    escalaX: objeto.scaleX,
    escalaY: objeto.scaleY,
  }));

  const atualizarPosicao = () => {
    const camera = scene.cameras.main;

    if (!camera) return;

    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;

    const origemX = camera.width * camera.originX;
    const origemY = camera.height * camera.originY;

    for (const item of elementos) {
      if (!item.objeto?.scene) continue;

      // Mantém as coordenadas originais no canto superior esquerdo.
      item.objeto.setPosition(
        origemX + (item.x - origemX) / zoomX,
        origemY + (item.y - origemY) / zoomY,
      );

      // Mantém o tamanho visual original durante o zoom.
      item.objeto.setScale(item.escalaX / zoomX, item.escalaY / zoomY);
    }
  };

  const limpar = () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizarPosicao);

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);

    if (scene.limparPainelStatusFixo === limpar) {
      scene.limparPainelStatusFixo = null;
    }
  };

  scene.limparPainelStatusFixo = limpar;

  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizarPosicao);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limpar);

  atualizarPosicao();
}

// =====================================================
// CRIAÇÃO DO STATUS
// =====================================================

function criarStatusPlayer(scene) {
  // VIDA
  scene.vidaMaxima = 100;
  scene.vida = 100;
  scene.regeneracaoVida = 4;
  scene.tempoSemDanoParaRegen = 4;
  scene.tempoSemDano = 0;

  // ESTAMINA
  scene.estaminaMaxima = 100;
  scene.estamina = 100;
  scene.custoAtaque = 20;
  scene.regeneracaoEstamina = 18;

  // CONFIGURAÇÃO DO HUD
  const x = 18;

  scene.larguraBarraStatus = 125;

  // PAINEL
  scene.painelStatus = scene.add.rectangle(10, 10, 145, 55, 0x05090d, 0.78);

  scene.painelStatus
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(299)
    .setStrokeStyle(1, 0x00d9ff, 0.45);

  // VIDA - TEXTO
  scene.textoVida = scene.add.text(x, 16, "HP", {
    fontFamily: "monospace",
    fontSize: "9px",
    color: "#ff6666",
    fontStyle: "bold",
  });

  scene.textoVida.setScrollFactor(0).setDepth(303);

  // VIDA - FUNDO
  scene.fundoVida = scene.add.rectangle(
    x,
    31,
    scene.larguraBarraStatus,
    7,
    0x180606,
    1,
  );

  scene.fundoVida.setOrigin(0, 0.5).setScrollFactor(0).setDepth(300);

  // VIDA - BARRA
  scene.barraVida = scene.add.rectangle(
    x,
    31,
    scene.larguraBarraStatus,
    7,
    0xe52b2b,
    1,
  );

  scene.barraVida.setOrigin(0, 0.5).setScrollFactor(0).setDepth(301);

  // VIDA - BORDA
  scene.bordaVida = scene.add.rectangle(x, 31, scene.larguraBarraStatus, 7);

  scene.bordaVida
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(302)
    .setStrokeStyle(1, 0xff5555, 0.7);

  // ESTAMINA - TEXTO
  scene.textoEstamina = scene.add.text(x, 39, "STM", {
    fontFamily: "monospace",
    fontSize: "9px",
    color: "#62ff7b",
    fontStyle: "bold",
  });

  scene.textoEstamina.setScrollFactor(0).setDepth(303);

  // ESTAMINA - FUNDO
  scene.fundoEstamina = scene.add.rectangle(
    x,
    54,
    scene.larguraBarraStatus,
    6,
    0x061508,
    1,
  );

  scene.fundoEstamina.setOrigin(0, 0.5).setScrollFactor(0).setDepth(300);

  // ESTAMINA - BARRA
  scene.barraEstamina = scene.add.rectangle(
    x,
    54,
    scene.larguraBarraStatus,
    6,
    0x31d158,
    1,
  );

  scene.barraEstamina.setOrigin(0, 0.5).setScrollFactor(0).setDepth(301);

  // ESTAMINA - BORDA
  scene.bordaEstamina = scene.add.rectangle(x, 54, scene.larguraBarraStatus, 6);

  scene.bordaEstamina
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(302)
    .setStrokeStyle(1, 0x62ff7b, 0.6);

  // Fixa o painel completo sem alterar seu visual.
  configurarPainelStatusFixo(scene);
}

// =====================================================
// ATUALIZA VIDA E ESTAMINA
// =====================================================

function atualizarStatusPlayer(scene, delta) {
  // REGENERAÇÃO DA ESTAMINA
  if (!scene.atacando && scene.estamina < scene.estaminaMaxima) {
    scene.estamina += scene.regeneracaoEstamina * (delta / 1000);

    scene.estamina = Math.min(scene.estamina, scene.estaminaMaxima);
  }

  // REGENERAÇÃO DA VIDA
  scene.tempoSemDano += delta;

  if (scene.tempoSemDano >= scene.tempoSemDanoParaRegen * 1000) {
    scene.vida += scene.regeneracaoVida * (delta / 1000);
    scene.vida = Math.min(scene.vida, scene.vidaMaxima);
  }

  // ATUALIZA VIDA
  const porcentagemVida = scene.vida / scene.vidaMaxima;

  scene.barraVida.width = scene.larguraBarraStatus * porcentagemVida;

  // ATUALIZA ESTAMINA
  const porcentagemEstamina = scene.estamina / scene.estaminaMaxima;

  scene.barraEstamina.width = scene.larguraBarraStatus * porcentagemEstamina;
}

// =====================================================
// GASTA ESTAMINA
// =====================================================

function gastarEstamina(scene, quantidade) {
  if (scene.estamina < quantidade) {
    return false;
  }

  scene.estamina -= quantidade;

  if (scene.estamina < 0) {
    scene.estamina = 0;
  }

  return true;
}

// =====================================================
// DANO
// =====================================================

function tomarDano(scene, quantidade) {
  scene.tempoSemDano = 0;
  scene.vida -= quantidade;

  scene.vida = Phaser.Math.Clamp(scene.vida, 0, scene.vidaMaxima);
}

// =====================================================
// RECUPERA VIDA
// =====================================================

function recuperarVida(scene, quantidade) {
  scene.vida += quantidade;

  scene.vida = Phaser.Math.Clamp(scene.vida, 0, scene.vidaMaxima);
}

export {
  criarStatusPlayer,
  atualizarStatusPlayer,
  gastarEstamina,
  tomarDano,
  recuperarVida,
};
