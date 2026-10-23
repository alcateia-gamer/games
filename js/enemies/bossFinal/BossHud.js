import { criarCanvasHUDNitido } from "../../ui/HudCanvas.js";

export const BOSS_HUD_TEXTURE = "boss-hud";
// Limites internos medidos no BARRA_VIDA_BOSS_2.png (724 × 241), incluindo sombras e brilhos.
// Os detalhes vermelhos/amarelos da moldura ficam fora destes recortes.
export const BOSS_HUD_BARS = Object.freeze({
  vida: { x: 71, y: 130, width: 578, height: 27 },
  estamina: { x: 169, y: 169, width: 380, height: 15 },
});

// Cortes nos divisores reais da arte; as cinco seções não têm larguras idênticas.
// Cada seção representa 20% da estamina (o custo de um ataque).
export const BOSS_STAMINA_EDGES = Object.freeze([0, 75, 151, 228, 305, 380]);

export function larguraEstamina(value, maximum) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  const sections = Math.max(0, Math.min(1, value / maximum)) * 5;
  const full = Math.floor(sections);
  if (full === 5) return BOSS_HUD_BARS.estamina.width;
  const start = BOSS_STAMINA_EDGES[full];
  const end = BOSS_STAMINA_EDGES[full + 1];
  return Math.round(start + (end - start) * (sections - full));
}

export function larguraPreenchida(value, maximum, width) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.round(width * Math.max(0, Math.min(1, value / maximum)));
}

/** Mantém o relevo da arte, mas remove toda a cor e o brilho da área vazia. */
export function esvaziarBarras(pixels, width) {
  for (const bar of Object.values(BOSS_HUD_BARS)) {
    for (let y = bar.y; y < bar.y + bar.height; y++) {
      for (let x = bar.x; x < bar.x + bar.width; x++) {
        const i = (y * width + x) * 4;
        const shade = Math.round((pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 +
          pixels[i + 2] * 0.0722) * 0.18);
        pixels[i] = pixels[i + 1] = pixels[i + 2] = shade;
      }
    }
  }
}

let nextId = 0;

/** Compõe a HUD em uma única imagem: não há bordas de sprites sobrepostas no corte. */
export function criarHudBoss(scene, boss) {
  const source = scene.textures.get(BOSS_HUD_TEXTURE).getSourceImage();
  const empty = document.createElement("canvas");
  empty.width = source.width;
  empty.height = source.height;
  const emptyContext = empty.getContext("2d", { willReadFrequently: true });
  emptyContext.drawImage(source, 0, 0);
  const pixels = emptyContext.getImageData(0, 0, empty.width, empty.height);
  esvaziarBarras(pixels.data, empty.width);
  emptyContext.putImageData(pixels, 0, 0);

  const key = `boss-hud-composicao-${++nextId}`;
  const texture = scene.textures.createCanvas(key, source.width, source.height);
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const context = texture.getContext();
  // Usa a mesma HUD nítida do minimapa, na densidade real da tela.
  const native = criarCanvasHUDNitido(scene, source.width, source.height, 100000);
  boss.hudVida = native?.object ?? scene.add.image(0, 0, key)
    .setOrigin(0).setScrollFactor(0).setDepth(100000);
  let previousLife = -1, previousStamina = -1;

  const atualizarHud = () => {
    const camera = scene.cameras.main;
    if (!camera || !boss.hudVida?.scene) return;
    const life = larguraPreenchida(boss.vida, boss.vidaMaxima, BOSS_HUD_BARS.vida.width);
    const stamina = larguraEstamina(boss.estamina, boss.estaminaMaxima);
    const changed = life !== previousLife || stamina !== previousStamina;
    if (changed) {
      context.clearRect(0, 0, source.width, source.height);
      context.drawImage(empty, 0, 0);
      // Vida e estamina esvaziam da direita para a esquerda, sem esticar a textura.
      for (const [bar, width] of [[BOSS_HUD_BARS.vida, life], [BOSS_HUD_BARS.estamina, stamina]]) {
        if (width > 0) context.drawImage(source, bar.x, bar.y, width, bar.height,
          bar.x, bar.y, width, bar.height);
      }
      if (!native) texture.refresh();
      previousLife = life;
      previousStamina = stamina;
    }
    if (native) {
      const resized = native.atualizarResolucao();
      if (changed || resized) {
        native.limpar();
        native.context.drawImage(texture.getSourceImage(), 0, 0);
      }
    }

    const scale = Math.min(400, camera.width * 0.46) / source.width;
    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;
    const ox = camera.width * camera.originX, oy = camera.height * camera.originY;
    const x = (camera.width - source.width * scale) / 2;
    const y = camera.height - source.height * scale - 8;
    boss.hudVida.setPosition(ox + (x - ox) / zoomX, oy + (y - oy) / zoomY)
      .setScale(scale / zoomX, scale / zoomY)
      .setVisible(!!(boss.active && boss.visible && !boss.morto && boss.dentroArena));
  };

  boss.atualizarHudVida = atualizarHud;
  scene.events.on("prerender", atualizarHud);
  let destroyed = false;
  boss.limparHudVida = () => {
    if (destroyed) return;
    destroyed = true;
    scene.events.off("prerender", atualizarHud);
    scene.events.off("shutdown", boss.limparHudVida);
    if (native) native.destroy();
    else boss.hudVida.destroy();
    scene.textures.remove(key);
    empty.width = empty.height = 0;
    boss.atualizarHudVida = null;
    boss.hudVida = null;
  };
  scene.events.once("shutdown", boss.limparHudVida);
  atualizarHud();
}
