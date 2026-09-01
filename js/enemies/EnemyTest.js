function criarInimigoTeste(scene) {
  // =====================================================
  // POSIÇÃO
  // =====================================================

  const x = scene.respawnX + 180;

  const y = scene.respawnY;

  // =====================================================
  // INIMIGO
  // =====================================================

  scene.inimigoTeste = scene.physics.add.sprite(x, y, "robo-teste");

  scene.inimigoTeste.setDepth(50);

  // =====================================================
  // TAMANHO
  // =====================================================

  scene.inimigoTeste.setScale(0.75);

  // =====================================================
  // FÍSICA
  // =====================================================

  scene.inimigoTeste.body.setAllowGravity(false);

  scene.inimigoTeste.setImmovable(true);

  // =====================================================
  // VIDA
  // =====================================================

  scene.inimigoTeste.vidaMaxima = 100;

  scene.inimigoTeste.vida = 100;

  // =====================================================
  // BARRA DE VIDA
  // =====================================================

  scene.inimigoTeste.larguraBarra = 60;

  scene.inimigoTeste.fundoVida = scene.add.rectangle(
    x,
    y - 65,
    60,
    6,
    0x111111,
    0.9,
  );

  scene.inimigoTeste.fundoVida.setDepth(60);

  scene.inimigoTeste.barraVida = scene.add.rectangle(
    x - 30,
    y - 65,
    60,
    6,
    0xe52b2b,
    1,
  );

  scene.inimigoTeste.barraVida.setOrigin(0, 0.5).setDepth(61);

  scene.inimigoTeste.bordaVida = scene.add.rectangle(x, y - 65, 60, 6);

  scene.inimigoTeste.bordaVida.setStrokeStyle(1, 0xffffff, 0.7).setDepth(62);
}

// =====================================================
// ATUALIZA INIMIGO
// =====================================================

function atualizarInimigoTeste(scene) {
  if (!scene.inimigoTeste || !scene.inimigoTeste.active) {
    return;
  }

  // =====================================================
  // POSIÇÃO DA VIDA
  // =====================================================

  const x = scene.inimigoTeste.x;

  const y = scene.inimigoTeste.y - 65;

  scene.inimigoTeste.fundoVida.setPosition(x, y);

  scene.inimigoTeste.barraVida.setPosition(x - 30, y);

  scene.inimigoTeste.bordaVida.setPosition(x, y);

  // =====================================================
  // TAMANHO DA VIDA
  // =====================================================

  const porcentagemVida =
    scene.inimigoTeste.vida / scene.inimigoTeste.vidaMaxima;

  scene.inimigoTeste.barraVida.width =
    scene.inimigoTeste.larguraBarra * porcentagemVida;
}

// =====================================================
// DANO
// =====================================================

function causarDanoInimigo(scene, quantidade) {
  if (!scene.inimigoTeste || !scene.inimigoTeste.active) {
    return;
  }

  scene.inimigoTeste.vida -= quantidade;

  scene.inimigoTeste.vida = Phaser.Math.Clamp(
    scene.inimigoTeste.vida,
    0,
    scene.inimigoTeste.vidaMaxima,
  );

  // =====================================================
  // EFEITO DE DANO
  // =====================================================

  scene.inimigoTeste.setTint(0xff5555);

  scene.time.delayedCall(100, () => {
    if (scene.inimigoTeste && scene.inimigoTeste.active) {
      scene.inimigoTeste.clearTint();
    }
  });

  // =====================================================
  // MORTE
  // =====================================================

  if (scene.inimigoTeste.vida <= 0) {
    destruirInimigoTeste(scene);
  }
}

// =====================================================
// DESTRÓI INIMIGO
// =====================================================

function destruirInimigoTeste(scene) {
  if (!scene.inimigoTeste) {
    return;
  }

  scene.inimigoTeste.fundoVida.destroy();

  scene.inimigoTeste.barraVida.destroy();

  scene.inimigoTeste.bordaVida.destroy();

  scene.inimigoTeste.destroy();
}

export { criarInimigoTeste, atualizarInimigoTeste, causarDanoInimigo };
