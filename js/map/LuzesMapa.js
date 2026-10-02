const TEXTURA_LUZ_POSTE = "luz-poste-radial";
const TEXTURA_FEIXE_POSTE = "luz-poste-feixe";
const TAMANHO_TEXTURA_LUZ = 256;
const LARGURA_TEXTURA_FEIXE = 256;
const ALTURA_TEXTURA_FEIXE = 384;
const DEPTH_LUZ_AMBIENTE = 11.25;
const DEBUG_LUZES = false;

function getProperty(object, name, defaultValue) {
  const property = object.properties?.find((item) => item.name === name);
  return property !== undefined ? property.value : defaultValue;
}

function criarTexturaLuzPoste(scene) {
  if (scene.textures.exists(TEXTURA_LUZ_POSTE)) return;

  const texture = scene.textures.createCanvas(
    TEXTURA_LUZ_POSTE,
    TAMANHO_TEXTURA_LUZ,
    TAMANHO_TEXTURA_LUZ,
  );
  const context = texture.getContext();
  const center = TAMANHO_TEXTURA_LUZ / 2;
  const gradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center,
  );

  gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  gradient.addColorStop(0.18, "rgba(255, 255, 255, 0.62)");
  gradient.addColorStop(0.48, "rgba(255, 255, 255, 0.22)");
  gradient.addColorStop(0.78, "rgba(255, 255, 255, 0.05)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, TAMANHO_TEXTURA_LUZ, TAMANHO_TEXTURA_LUZ);
  texture.refresh();
}

function criarTexturaFeixePoste(scene) {
  if (scene.textures.exists(TEXTURA_FEIXE_POSTE)) return;

  const texture = scene.textures.createCanvas(
    TEXTURA_FEIXE_POSTE,
    LARGURA_TEXTURA_FEIXE,
    ALTURA_TEXTURA_FEIXE,
  );
  const context = texture.getContext();
  const centerX = LARGURA_TEXTURA_FEIXE / 2;

  context.save();
  context.filter = "blur(10px)";
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(centerX - 8, 0);
  context.lineTo(centerX + 8, 0);
  context.lineTo(LARGURA_TEXTURA_FEIXE - 8, ALTURA_TEXTURA_FEIXE);
  context.lineTo(8, ALTURA_TEXTURA_FEIXE);
  context.closePath();
  context.fill();
  context.restore();

  context.globalCompositeOperation = "destination-in";

  const sideGradient = context.createLinearGradient(
    0,
    0,
    LARGURA_TEXTURA_FEIXE,
    0,
  );
  sideGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  sideGradient.addColorStop(0.18, "rgba(255, 255, 255, 0.12)");
  sideGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.75)");
  sideGradient.addColorStop(0.82, "rgba(255, 255, 255, 0.12)");
  sideGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = sideGradient;
  context.fillRect(0, 0, LARGURA_TEXTURA_FEIXE, ALTURA_TEXTURA_FEIXE);

  const lengthGradient = context.createLinearGradient(
    0,
    0,
    0,
    ALTURA_TEXTURA_FEIXE,
  );
  lengthGradient.addColorStop(0, "rgba(255, 255, 255, 0.14)");
  lengthGradient.addColorStop(0.12, "rgba(255, 255, 255, 0.68)");
  lengthGradient.addColorStop(0.58, "rgba(255, 255, 255, 0.48)");
  lengthGradient.addColorStop(0.9, "rgba(255, 255, 255, 0.24)");
  lengthGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = lengthGradient;
  context.fillRect(0, 0, LARGURA_TEXTURA_FEIXE, ALTURA_TEXTURA_FEIXE);

  context.globalCompositeOperation = "source-over";
  texture.refresh();
}

function criarLuzPoste(scene, x, y, raio, intensidade, cor, depths) {
  const comprimentoFeixe = raio * 0.55;
  const tamanhoGlow = Math.max(14, Math.min(raio * 0.25, 44));
  const yFinalFeixe = y + 4 + comprimentoFeixe;
  const yCentroLuzChao = yFinalFeixe + 10;

  const glowTopo = scene.add
    .image(x, y, TEXTURA_LUZ_POSTE)
    .setOrigin(0.5)
    .setDisplaySize(tamanhoGlow, tamanhoGlow)
    .setTint(cor)
    .setAlpha(intensidade * 1.05)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(depths.alwaysAboveWorld + 0.1);

  const feixe = scene.add
    .image(x, y + 4, TEXTURA_FEIXE_POSTE)
    .setOrigin(0.5, 0)
    .setDisplaySize(raio * 1.4, comprimentoFeixe)
    .setTint(cor)
    .setAlpha(intensidade * 1.05)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH_LUZ_AMBIENTE);

  const luzChao = scene.add
    .image(x, yCentroLuzChao, TEXTURA_LUZ_POSTE)
    .setOrigin(0.5)
    .setDisplaySize(raio * 0.95, raio * 0.32)
    .setTint(cor)
    .setAlpha(intensidade * 1.1)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH_LUZ_AMBIENTE);

  return { glowTopo, feixe, luzChao, yFinalFeixe };
}

function criarLuzesPostes(scene, map, depths) {
  const luzesLayer = map.getObjectLayer("Luzes");

  if (!luzesLayer) return;

  const pontos = luzesLayer.objects.filter((object) => object.point);

  if (pontos.length === 0) return;

  criarTexturaLuzPoste(scene);
  criarTexturaFeixePoste(scene);

  const debugGraphics =
    DEBUG_LUZES || scene.DEBUG_LUZES
      ? scene.add.graphics().setDepth(100)
      : null;

  scene.luzesPostes = pontos.map((object) => {
    const raio = getProperty(object, "Raio", 180);
    const intensidade = getProperty(object, "Intensidade", 0.4);
    const corString = getProperty(object, "Cor", "0xffdd88");
    const cor = Number(corString);

    const luz = criarLuzPoste(
      scene,
      object.x,
      object.y,
      raio,
      intensidade,
      cor,
      depths,
    );

    if (debugGraphics) {
      debugGraphics.lineStyle(1, 0x00ffff, 0.8);
      debugGraphics.lineBetween(object.x, object.y, object.x, luz.yFinalFeixe);
      debugGraphics.strokeCircle(object.x, object.y, 5);
      debugGraphics.strokeCircle(object.x, luz.yFinalFeixe, 7);
    }

    return luz;
  });
}

export { criarLuzesPostes };
