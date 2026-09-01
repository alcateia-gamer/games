function criarStatusPlayer(scene) {
  // =====================================================
  // VIDA
  // =====================================================

  scene.vidaMaxima = 100;
  scene.vida = 100;

  // =====================================================
  // ESTAMINA
  // =====================================================

  scene.estaminaMaxima = 100;
  scene.estamina = 100;

  scene.custoAtaque = 20;

  scene.regeneracaoEstamina = 18;

  // =====================================================
  // CONFIGURAÇÃO DO HUD
  // =====================================================

  const x = 18;

  scene.larguraBarraStatus = 125;

  // =====================================================
  // PAINEL DO HUD
  // =====================================================

  scene.painelStatus = scene.add.rectangle(10, 10, 145, 55, 0x05090d, 0.78);

  scene.painelStatus
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(299)
    .setStrokeStyle(1, 0x00d9ff, 0.45);

  // =====================================================
  // VIDA - TEXTO
  // =====================================================

  scene.textoVida = scene.add.text(x, 16, "HP", {
    fontFamily: "monospace",
    fontSize: "9px",
    color: "#ff6666",
    fontStyle: "bold",
  });

  scene.textoVida.setScrollFactor(0).setDepth(303);

  // =====================================================
  // VIDA - FUNDO
  // =====================================================

  scene.fundoVida = scene.add.rectangle(
    x,
    31,
    scene.larguraBarraStatus,
    7,
    0x180606,
    1,
  );

  scene.fundoVida.setOrigin(0, 0.5).setScrollFactor(0).setDepth(300);

  // =====================================================
  // VIDA - BARRA
  // =====================================================

  scene.barraVida = scene.add.rectangle(
    x,
    31,
    scene.larguraBarraStatus,
    7,
    0xe52b2b,
    1,
  );

  scene.barraVida.setOrigin(0, 0.5).setScrollFactor(0).setDepth(301);

  // =====================================================
  // VIDA - BORDA
  // =====================================================

  scene.bordaVida = scene.add.rectangle(x, 31, scene.larguraBarraStatus, 7);

  scene.bordaVida
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(302)
    .setStrokeStyle(1, 0xff5555, 0.7);

  // =====================================================
  // ESTAMINA - TEXTO
  // =====================================================

  scene.textoEstamina = scene.add.text(x, 39, "STM", {
    fontFamily: "monospace",
    fontSize: "9px",
    color: "#62ff7b",
    fontStyle: "bold",
  });

  scene.textoEstamina.setScrollFactor(0).setDepth(303);

  // =====================================================
  // ESTAMINA - FUNDO
  // =====================================================

  scene.fundoEstamina = scene.add.rectangle(
    x,
    54,
    scene.larguraBarraStatus,
    6,
    0x061508,
    1,
  );

  scene.fundoEstamina.setOrigin(0, 0.5).setScrollFactor(0).setDepth(300);

  // =====================================================
  // ESTAMINA - BARRA
  // =====================================================

  scene.barraEstamina = scene.add.rectangle(
    x,
    54,
    scene.larguraBarraStatus,
    6,
    0x31d158,
    1,
  );

  scene.barraEstamina.setOrigin(0, 0.5).setScrollFactor(0).setDepth(301);

  // =====================================================
  // ESTAMINA - BORDA
  // =====================================================

  scene.bordaEstamina = scene.add.rectangle(x, 54, scene.larguraBarraStatus, 6);

  scene.bordaEstamina
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(302)
    .setStrokeStyle(1, 0x62ff7b, 0.6);
}

// =====================================================
// ATUALIZA VIDA E ESTAMINA
// =====================================================

function atualizarStatusPlayer(scene, delta) {
  // =====================================================
  // REGENERAÇÃO DA ESTAMINA
  // =====================================================

  if (!scene.atacando && scene.estamina < scene.estaminaMaxima) {
    scene.estamina += scene.regeneracaoEstamina * (delta / 1000);

    scene.estamina = Math.min(scene.estamina, scene.estaminaMaxima);
  }

  // =====================================================
  // ATUALIZA VIDA
  // =====================================================

  const porcentagemVida = scene.vida / scene.vidaMaxima;

  scene.barraVida.width = scene.larguraBarraStatus * porcentagemVida;

  // =====================================================
  // ATUALIZA ESTAMINA
  // =====================================================

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
