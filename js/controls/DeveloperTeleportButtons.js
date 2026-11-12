import { iniciarTransicao } from "../core/MapTransition.js";
import { criarBotaoHUDNitido } from "../ui/HudCanvas.js";

/** Os mesmos destinos de P e O ficam disponíveis no DEV dos aparelhos com toque. */
export function criarBotoesTeleporteDev(scene) {
  const device = scene.sys?.game?.device;
  if (!device?.input?.touch && device?.os?.desktop !== false &&
      !(typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)) return;
  const destinos = [
    { titulo: "FÁBRICA", cidade: true, executar: () => iniciarTransicao(scene) },
    { titulo: "BOSS", executar: () => scene.teleportarDevBoss?.() },
  ];
  const botoes = destinos.map(destino => {
    const fundo = scene.add.rectangle(0, 0, 90, 34, 0x1f2937, 0.95)
      .setStrokeStyle(2, 0x6ee7b7, 1).setScrollFactor(0).setDepth(200)
      .setVisible(false).setInteractive({ useHandCursor: true });
    const texto = scene.add.text(0, 0, destino.titulo, { fontSize: "12px", color: "#e5e7eb",
      fontStyle: "bold", fontFamily: "monospace" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(201).setVisible(false);
    fundo.on("pointerdown", () => {
      if (!permitido() || (destino.cidade && scene.sys.settings.key !== "Level1")) return;
      destino.executar();
    });
    return { fundo, texto, destino };
  });
  const permitido = () => scene.developerMode && scene.player?.active &&
    !scene.morteEmAndamento && !scene.transicaoEmAndamento && !scene.transicaoRetornoEmAndamento &&
    !scene.generatorMenuOpen && !scene.devItemMenuOpen && !scene.cenaEntradaBossAtiva;
  const atualizar = () => {
    const camera = scene.cameras.main;
    const zx = camera.zoomX || camera.zoom || 1, zy = camera.zoomY || camera.zoom || 1;
    const ox = camera.width * camera.originX, oy = camera.height * camera.originY;
    botoes.forEach(({ fundo, texto, destino }, i) => {
      const visivel = !!permitido() && (!destino.cidade || scene.sys.settings.key === "Level1");
      const x = ox + (camera.width - 50 - i * 100 - ox) / zx;
      const y = oy + ((scene.minimap?.devScreenY ?? 24) + 40 - oy) / zy;
      fundo.setVisible(visivel).setPosition(x, y).setScale(1 / zx, 1 / zy);
      texto.setVisible(visivel).setPosition(x, y).setScale(1 / zx, 1 / zy);
    });
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizar);
  });
  atualizar();
  for (const { fundo, texto } of botoes) criarBotaoHUDNitido(scene, fundo, texto);
}
