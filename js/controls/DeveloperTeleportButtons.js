import { iniciarTransicao } from "../core/MapTransition.js";
import { criarBotaoHUDNitido } from "../ui/HudCanvas.js";
import { podeValidarFabricaDev, solicitarValidacaoFabricaDev } from "./DeveloperFactory.js";

const ALTURA_ATALHO = 34;
const CENTRO_ATALHO_ABAIXO_DEV = 40;

/** Os atalhos DEV de teleporte e validação ficam disponíveis nos aparelhos com toque. */
export function criarBotoesTeleporteDev(scene) {
  const device = scene.sys?.game?.device;
  if (!device?.input?.touch && device?.os?.desktop !== false &&
      !(typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)) return;
  const destinos = [
    scene.sys.settings.key === "Level1Parte2"
      ? { titulo: "VALIDAR HACKS", disponivel: () => podeValidarFabricaDev(scene),
        executar: () => solicitarValidacaoFabricaDev(scene) }
      : { titulo: "FÁBRICA", disponivel: () => scene.sys.settings.key === "Level1",
        executar: () => iniciarTransicao(scene) },
    { titulo: "BOSS", executar: () => scene.teleportarDevBoss?.() },
  ];
  const botoes = destinos.map(destino => {
    const fundo = scene.add.rectangle(0, 0, 90, ALTURA_ATALHO, 0x1f2937, 0.95)
      .setStrokeStyle(2, 0x6ee7b7, 1).setScrollFactor(0).setDepth(200)
      .setVisible(false).setInteractive({ useHandCursor: true });
    const texto = scene.add.text(0, 0, destino.titulo, { fontSize: "12px", color: "#e5e7eb",
      fontStyle: "bold", fontFamily: "monospace" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(201).setVisible(false);
    fundo.on("pointerdown", () => {
      if (!permitido() || destino.disponivel?.() === false) return;
      destino.executar();
    });
    return { fundo, texto, destino };
  });
  const permitido = () => scene.developerMode && scene.player?.active &&
    !scene.morteEmAndamento && !scene.transicaoEmAndamento && !scene.transicaoRetornoEmAndamento &&
    !(scene.generatorMenuOpen || scene.upgradeMenuOpen) && !scene.devItemMenuOpen && !scene.cenaEntradaBossAtiva;
  scene.espacoAtalhosDev = () => permitido()
    ? Math.max(0, CENTRO_ATALHO_ABAIXO_DEV + ALTURA_ATALHO / 2 + 1 - (scene.botaoDesenvolvedor?.height ?? 30) / 2)
    : 0;
  const atualizar = () => {
    const camera = scene.cameras.main;
    const zx = camera.zoomX || camera.zoom || 1, zy = camera.zoomY || camera.zoom || 1;
    const ox = camera.width * camera.originX, oy = camera.height * camera.originY;
    botoes.forEach(({ fundo, texto, destino }, i) => {
      const visivel = !!permitido() && destino.disponivel?.() !== false;
      const x = ox + (camera.width - 50 - i * 100 - ox) / zx;
      const y = oy + ((scene.minimap?.devScreenY ?? 24) + CENTRO_ATALHO_ABAIXO_DEV - oy) / zy;
      fundo.setVisible(visivel).setPosition(x, y).setScale(1 / zx, 1 / zy);
      texto.setVisible(visivel).setPosition(x, y).setScale(1 / zx, 1 / zy);
    });
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizar);
    scene.espacoAtalhosDev = null;
  });
  atualizar();
  for (const { fundo, texto } of botoes) criarBotaoHUDNitido(scene, fundo, texto);
}
