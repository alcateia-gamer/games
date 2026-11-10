/** Abastecimento do galão nas áreas Gasolina do Tiled, com progresso persistente no inventário. */
import { criarFalaFlutuante } from "../ui/PlayerSpeechBubble.js";
import { createInteractionMarker } from "../ui/CollectibleMarker.js";
import { criarSomEnchendoGalao } from "../sounds/enchendoGalao.js";

export const FUEL_FILL_DURATION_MS = 4000;
export const FUEL_INTERACTION_RANGE = 48;
export const FUEL_USED_KEY = "tanqueCombustivelUsado";

export const FALAS_GALAO = {
  vazio: [
    "O galão está vazio. Preciso enchê-lo antes de usar no gerador.",
    "Achei um galão, mas está vazio. Preciso de gasolina.",
    "Sem combustível ainda. Vou procurar onde encher este galão.",
    "Galão vazio. Antes do gerador, preciso achar gasolina.",
  ],
  semGalao: [
    "Preciso encontrar um galão para levar combustível.",
    "Tem gasolina aqui, mas preciso de um galão para levar.",
    "Preciso trazer um galão para encher aqui.",
    "Achei combustível. Falta um galão para levar ao gerador.",
  ],
  jaCheio: [
    "O galão já está cheio.",
    "Não cabe mais gasolina. Hora de voltar ao gerador.",
    "Já tenho combustível suficiente neste galão.",
    "Está cheio. Preciso levar este galão ao gerador.",
  ],
  abastecido: [
    "Galão cheio. Agora posso abastecer o gerador.",
    "Pronto, galão cheio. Hora de levar o combustível ao gerador.",
    "Agora sim, combustível para o gerador.",
    "Terminei de encher o galão. Próxima parada: o gerador.",
  ],
};

export function lerAreasGasolina(map) {
  const layers = map?.objects ?? map?.layers ?? [];
  return layers.filter(layer => layer.name?.toLowerCase() === "gasolina")
    .flatMap(layer => layer.objects ?? [])
    .filter(object => object.visible !== false && !object.point && !object.gid &&
      !object.ellipse && !object.polygon && !object.polyline && !object.text &&
      [object.x, object.y, object.width, object.height, object.rotation ?? 0].every(Number.isFinite) &&
      object.width > 0 && object.height > 0)
    .map(object => ({ x: object.x, y: object.y, width: object.width, height: object.height,
      rotation: (object.rotation ?? 0) * Math.PI / 180 }));
}

export function distanciaAreaGasolina(point, area) {
  const dx = point.x - area.x, dy = point.y - area.y;
  const cos = Math.cos(area.rotation), sin = Math.sin(area.rotation);
  const x = dx * cos + dy * sin, y = -dx * sin + dy * cos;
  return Math.hypot(x - Math.max(0, Math.min(area.width, x)),
    y - Math.max(0, Math.min(area.height, y)));
}

export function centroAreaGasolina(area) {
  const cos = Math.cos(area.rotation), sin = Math.sin(area.rotation);
  return { x: area.x + (area.width * cos - area.height * sin) / 2,
    y: area.y + (area.width * sin + area.height * cos) / 2 };
}

export function criarSistemaCombustivel(scene) {
  const inventory = scene.inventory;
  const areas = lerAreasGasolina(scene.map);
  const tanque = (scene.tanqueCombustivelObjects ?? []).map(visual => visual.getBounds());
  for (const [index, area] of areas.entries()) {
    const centro = centroAreaGasolina(area);
    createInteractionMarker(scene, {
      x: areas.length === 1 && tanque.length
        ? (Math.min(...tanque.map(b => b.left)) + Math.max(...tanque.map(b => b.right))) / 2 : centro.x,
      y: areas.length === 1 && tanque.length ? Math.min(...tanque.map(b => b.top)) - 22 : area.y - 60,
      name: index === 0 ? "fuel-tank-marker" : `fuel-tank-marker-${index}`,
      stateKey: FUEL_USED_KEY,
    });
  }
  const fala = criarFalaFlutuante(scene, "fuel-speech-bubble");
  scene.falaCombustivel = fala;
  let abastecendo = null;
  let encerrado = false;
  const som = criarSomEnchendoGalao(scene);

  const ui = scene.add.container(0, 0).setDepth(502).setName("fuel-fill-progress").setVisible(false);
  const fundo = scene.add.rectangle(0, 0, 176, 37, 0x07121d, 0.96).setStrokeStyle(1, 0xf3c24b);
  const label = scene.add.text(0, -7, "", {
    fontFamily: "monospace", fontSize: "11px", fontStyle: "bold", color: "#ffe29a", resolution: 3,
  }).setOrigin(0.5);
  // O texto HTML acompanha o mundo, mas o navegador desenha as letras na densidade da tela.
  const labelNitido = criarRotuloAbastecimento(scene);
  if (labelNitido) label.setAlpha(0);
  const trilho = scene.add.rectangle(-65, 9, 130, 5, 0x26333c).setOrigin(0, 0.5);
  const barra = scene.add.rectangle(-65, 9, 130, 5, 0xf3c24b).setOrigin(0, 0.5)
    .setName("fuel-fill-bar");
  ui.add([fundo, trilho, barra, label]);

  const permitido = () => !encerrado && !!scene.player?.active && !scene.player.morto &&
    !scene.morteEmAndamento && !scene.generatorMenuOpen && !scene.devItemMenuOpen &&
    !scene.cenaEntradaBossAtiva && !scene.movimentoBloqueado;
  const centroJogador = () => scene.player?.body?.center ?? scene.player;
  const incompleto = () => inventory.getSlots().find(slot => slot.itemId === "gasolina" && slot.fuel < 1);
  const ocultarProgresso = () => { ui.setVisible(false); labelNitido?.setVisible(false); };
  const cancelar = () => { abastecendo = null; som.parar(); ocultarProgresso(); };
  const iniciar = area => {
    if (!permitido() || distanciaAreaGasolina(centroJogador(), area) > FUEL_INTERACTION_RANGE) return false;
    if (!inventory.getQuantity("gasolina")) {
      fala.mostrar(FALAS_GALAO.semGalao);
      return true;
    }
    if (!incompleto()) { fala.mostrar(FALAS_GALAO.jaCheio); return true; }
    scene.registry?.set(FUEL_USED_KEY, true);
    abastecendo = area;
    som.iniciar();
    fala.ocultar();
    scene.player.setVelocity(0, 0);
    return true;
  };

  scene.atualizarAbastecimento = (delta = 0) => {
    scene.interacaoCombustivelProxima = null;
    if (!permitido()) { cancelar(); return; }
    if (abastecendo) {
      if (distanciaAreaGasolina(centroJogador(), abastecendo) > FUEL_INTERACTION_RANGE || !incompleto()) {
        cancelar();
      } else if (Number.isFinite(delta) && delta > 0) {
        const nivel = inventory.fillFuel(Math.min(delta, 100) / FUEL_FILL_DURATION_MS);
        if (nivel === 1) { cancelar(); fala.mostrar(FALAS_GALAO.abastecido); }
      }
    }
    if (abastecendo || (inventory.getQuantity("gasolina") > 0 && !incompleto())) return;
    let proxima = null, distance = Infinity;
    for (const area of areas) {
      const atual = distanciaAreaGasolina(centroJogador(), area);
      if (atual <= FUEL_INTERACTION_RANGE && atual < distance) { proxima = area; distance = atual; }
    }
    if (proxima) scene.interacaoCombustivelProxima = { distance, area: proxima,
      interact: () => iniciar(proxima) };
  };

  const desenhar = () => {
    fala.atualizar();
    if (!permitido()) { cancelar(); return; }
    const candidata = scene.interacaoCombustivelProxima?.area;
    const area = abastecendo ?? candidata;
    if (!area || (!abastecendo && !incompleto())) { ocultarProgresso(); return; }
    const nivel = incompleto()?.fuel ?? 0;
    label.setText(abastecendo ? `ENCHENDO GALÃO · ${Math.floor(nivel * 100)}%` : "E / TOQUE · ENCHER GALÃO");
    barra.setScale(nivel, 1);
    ui.setPosition(abastecendo ? scene.player.x : area.x + area.width / 2,
      abastecendo ? (scene.hitboxDanoPlayer?.y ?? scene.player.y - 50) - 24 : area.y - 30)
      .setVisible(true);
    if (labelNitido) {
      labelNitido.node.textContent = label.text;
      labelNitido.updateSize();
      labelNitido.setPosition(ui.x, ui.y + label.y).setVisible(true);
    }
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, desenhar);
  scene.events.on("pause", cancelar);
  scene.events.on("sleep", cancelar);
  scene.game.events.on("blur", cancelar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    encerrado = true;
    som.destruir();
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, desenhar);
    scene.events.off("pause", cancelar);
    scene.events.off("sleep", cancelar);
    scene.game.events.off("blur", cancelar);
    ui.destroy();
    labelNitido?.destroy();
    fala.destroy();
    scene.falaCombustivel = null;
    scene.atualizarAbastecimento = null;
    scene.interacaoCombustivelProxima = null;
  });
}

function criarRotuloAbastecimento(scene) {
  if (!scene.add.dom) return null;
  const node = document.createElement("div");
  node.setAttribute("data-fuel-fill-label", "");
  Object.assign(node.style, {
    font: "bold 11px monospace", color: "#ffe29a", whiteSpace: "nowrap",
    lineHeight: "14px", textAlign: "center", pointerEvents: "none",
    textRendering: "optimizeLegibility",
  });
  const label = scene.add.dom(0, 0, node).setOrigin(0.5).setDepth(503)
    .setName("fuel-fill-label-native").setVisible(false);
  label.pointerEvents = "none";
  return label;
}
