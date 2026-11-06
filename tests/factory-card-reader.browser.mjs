/** Passagem automática do crachá, cancelamento e portas no Phaser/WebGL real. */
import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
}, {}, { hasTouch: true, deviceScaleFactor: 2 });
const { page } = session;
const sombrasBoss = () => page.evaluate(() => window.__game.scene.getScene("Level1Parte2")
  .zonasLuzApagada.zonas.filter(z => [1602, 1603].includes(z.id))
  .map(z => ({ id: z.id, porta: z.porta?.nome, opacidade: z.opacidade })));
const state = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("Level1Parte2");
  return { open: !!s.cardReaderMenuOpen, blocked: s.movimentoBloqueado,
    card: s.inventory.getQuantity("card"),
    doors: s.portasFabrica.filter(p => ["porta02", "porta03"].includes(p.nome)).map(p => p.estado),
    status: s.children.getByName("card-reader-modal").list[1].getByName("card-reader-status").text,
    phases: [...(s.__cardReaderPhases ?? [])] };
});
try {
  const areas = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.inventory.removeItem("card", s.inventory.getQuantity("card")); s.luzFabricaAcesa = false;
    // Segura os tweens para conferir e cancelar o painel antes da leitura automática.
    s.tweens.timeScale = 0;
    return { leitor: s.leitorCartaoFabrica.area,
      iniciais: s.portasFabrica.filter(p => ["porta01", "porta04"].includes(p.nome))
        .map(p => ({ nome: p.nome, ...p.area })) };
  });
  await session.posicionar(areas.iniciais[0].x + areas.iniciais[0].width / 2,
    areas.iniciais[0].y + areas.iniciais[0].height + 16);
  await session.retomar();
  for (const porta of areas.iniciais) {
    await session.posicionar(porta.x + porta.width / 2, porta.y + porta.height + 16);
    await page.evaluate(() => {
      const s = window.__game.scene.getScene("Level1Parte2");
      s.leitorCartaoFabrica.fala.ocultar();
      s.atualizarInteracaoPortaFabrica();
    });
    await page.keyboard.press("e", { delay: 300 });
    await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").leitorCartaoFabrica.fala.texto.visible);
    const energia = await page.evaluate(async nome => {
      const s = window.__game.scene.getScene("Level1Parte2");
      const porta = s.portasFabrica.find(p => p.nome === nome), area = porta.area;
      const { worldToMiniMap } = await import("/js/ui/MiniMapData.js");
      const map = s.minimap;
      map.update();
      const p = worldToMiniMap(map.transform, area.x + area.width / 2, area.y + area.height / 2);
      const view = map.nativeView, scale = view.canvas.width / view.width;
      const pixels = view.context.getImageData(Math.floor((p.x + 2 - 8) * scale),
        Math.floor((p.y + 2 - 7) * scale), Math.ceil(16 * scale), Math.ceil(14 * scale)).data;
      let gray = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] === 137 && pixels[i + 1] === 150 && pixels[i + 2] === 157) gray++;
      }
      return { estado: porta.estado, marcador: porta.marcador.visible, gray,
        avisos: s.children.list.filter(o => o.type === "Text" &&
          o.x === area.x + area.width / 2 && o.y === area.y - 12).length,
        frase: s.leitorCartaoFabrica.fala.texto.text };
    }, porta.nome);
    assert.equal(energia.estado, "fechada");
    assert.equal(energia.marcador, true);
    assert.equal(energia.avisos, 0);
    assert.ok(energia.gray > 0, "a persiana cinza aparece no minimapa nítido");
    assert.match(energia.frase, /energia|gerador/);
    assert.doesNotMatch(energia.frase, /cartão|leitor/);
    await page.screenshot({ path: `/tmp/factory-${porta.nome}-no-power.png` });
  }
  const area = areas.leitor;
  await session.posicionar(area.x + area.width / 2, area.y + area.height + 16);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.leitorCartaoFabrica.fala.ocultar();
    s.luzFabricaAcesa = true;
    s.atualizarInteracaoPortaFabrica();
  });
  await page.waitForFunction(() => !!window.__game.scene.getScene("Level1Parte2").interacaoMundoProxima);
  const markers = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { worldToMiniMap } = await import("/js/ui/MiniMapData.js");
    const map = s.minimap, reader = s.leitorCartaoFabrica;
    const p = worldToMiniMap(map.transform, reader.area.x + reader.area.width / 2,
      reader.area.y + reader.area.height / 2);
    const view = map.nativeView, scale = view.canvas.width / view.width;
    const data = view.context.getImageData(Math.floor((p.x + 2 - 8) * scale),
      Math.floor((p.y + 2 - 6) * scale), Math.ceil(16 * scale), Math.ceil(12 * scale)).data;
    let yellow = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 180 && data[i + 1] > 120 && data[i + 2] < 120) yellow++;
    return { visible: reader.marcador.visible, oldPrompt: !!reader.prompt, yellow };
  });
  assert.equal(markers.visible, true);
  assert.equal(markers.oldPrompt, false);
  assert.ok(markers.yellow > 0, "o cartão amarelo aparece no canvas nítido do minimapa");
  const sombrasFechadas = await sombrasBoss();
  assert.equal(sombrasFechadas.length, 2);
  assert.ok(sombrasFechadas.every(z => ["porta02", "porta03"].includes(z.porta) && z.opacidade === 1),
    "os dois trechos da sombra do boss aguardam a abertura das portas");
  await page.keyboard.press("e", { delay: 300 });
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").leitorCartaoFabrica.fala.texto.visible);
  const speech = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), text = s.leitorCartaoFabrica.fala.texto;
    return { message: text.text, color: text.style.color, background: text.style.backgroundColor,
      above: text.y < s.player.y, headGap: s.hitboxDanoPlayer.y - text.y,
      sideOffset: text.x - s.player.x, width: text.displayWidth, menu: !!s.cardReaderMenuOpen };
  });
  assert.equal(speech.message, "Preciso encontrar o cartão de acesso.");
  assert.equal(speech.color, "#ffffff");
  assert.equal(speech.background, "#145c37");
  assert.equal(speech.above, true);
  assert.equal(speech.headGap, -10);
  assert.equal(speech.sideOffset, 16);
  assert.ok(speech.width > 80 && speech.width <= 156, "o balão se estende para o lado para acomodar a fala");
  assert.equal(speech.menu, false);
  const nativeSpeech = page.locator("[data-player-speech-bubble]");
  await nativeSpeech.waitFor({ state: "visible" });
  assert.equal((await nativeSpeech.innerText()).replace(/\s+/g, " ").trim(), speech.message);
  const sharpSpeech = await nativeSpeech.evaluate(node => {
    const s = window.__game.scene.getScene("Level1Parte2"), text = s.leitorCartaoFabrica.fala.texto;
    const camera = s.cameras.main, canvas = window.__game.canvas.getBoundingClientRect();
    const point = camera.matrix.transformPoint(text.x, text.y);
    const scaleX = canvas.width / s.scale.gameSize.width;
    const scaleY = canvas.height / s.scale.gameSize.height;
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    return { fontSize: style.fontSize, weight: style.fontWeight, pointerEvents: style.pointerEvents,
      xError: Math.abs(rect.left - (canvas.left + point.x * scaleX)),
      yError: Math.abs(rect.bottom - (canvas.top + point.y * scaleY)) };
  });
  assert.equal(sharpSpeech.fontSize, "11px");
  assert.equal(sharpSpeech.weight, "700");
  assert.equal(sharpSpeech.pointerEvents, "none");
  assert.ok(sharpSpeech.xError < 1 && sharpSpeech.yError < 1,
    `a fala nativa acompanha a cabeça na câmera: ${JSON.stringify(sharpSpeech)}`);
  await page.screenshot({ path: "/tmp/factory-reader-no-card.png" });
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.leitorCartaoFabrica.fala.ocultar();
    s.inventory.addItem("card", 1);
    s.acenderLuzFabrica();
  });
  await page.keyboard.press("e", { delay: 300 });
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").cardReaderMenuOpen);
  assert.equal(await nativeSpeech.isVisible(), false);
  const display = page.locator("canvas[data-card-reader-display]");
  assert.equal(await display.isVisible(), true);
  const initial = await state();
  assert.deepEqual(initial.doors, ["fechada", "fechada"]);
  assert.equal(initial.blocked, true);
  assert.equal(initial.status, "POSICIONANDO CARTÃO...");
  const sharp = await display.evaluate(canvas => ({ pixels: canvas.width,
    expected: Math.round(canvas.getBoundingClientRect().width * devicePixelRatio) }));
  assert.equal(sharp.pixels, sharp.expected);
  await page.screenshot({ path: "/tmp/factory-card-reader-automatic.png" });

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !window.__game.scene.getScene("Level1Parte2").cardReaderMenuOpen);
  assert.equal((await state()).blocked, false);
  assert.deepEqual((await state()).doors, ["fechada", "fechada"]);
  assert.equal(await display.isVisible(), false);
  await page.waitForFunction(() => !!window.__game.scene.getScene("Level1Parte2").interacaoMundoProxima);
  await page.keyboard.press("e", { delay: 300 });
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").cardReaderMenuOpen);
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").cameras.main.setZoom(2.15); });
  await page.setViewportSize({ width: 960, height: 720 });
  await page.waitForFunction(() => {
    const r = document.querySelector("canvas[data-card-reader-display]").getBoundingClientRect();
    const g = window.__game.canvas.getBoundingClientRect();
    return Math.abs(r.x + r.width / 2 - g.x - g.width / 2) < 1 &&
      Math.abs(r.y + r.height / 2 - g.y - g.height / 2) < 1;
  });
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.__cardReaderPhases = new Set();
    const observe = () => {
      const panel = s.children.getByName("card-reader-modal").list[1];
      s.__cardReaderPhases.add(panel.getByName("card-reader-status").text);
      if (!s.cardReaderMenuOpen) s.events.off("prerender", observe);
    };
    s.events.on("prerender", observe);
    observe();
    s.tweens.timeScale = 1;
  });
  // Nenhum arraste, clique no cartão ou ajuste de velocidade é necessário.
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return !s.cardReaderMenuOpen && s.portasFabrica
      .filter(p => ["porta02", "porta03"].includes(p.nome)).every(p => p.estado === "aberta");
  });
  const final = await state();
  assert.equal(final.blocked, false);
  assert.equal(final.card, 1);
  await page.waitForFunction(() => {
    const zonas = window.__game.scene.getScene("Level1Parte2").zonasLuzApagada.zonas
      .filter(z => [1602, 1603].includes(z.id));
    return zonas.length === 2 && zonas.every(z => z.opacidade === 0);
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    const camera = window.__game.scene.getScene("Level1Parte2").cameras.main;
    camera.stopFollow(); camera.setZoom(1); camera.centerOn(-1080, -5400);
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "/tmp/factory-boss-door-revealed.png" });
  for (const phase of ["POSICIONANDO CARTÃO...", "LENDO CARTÃO...", "✓ ACESSO AUTORIZADO"]) {
    assert.ok(final.phases.includes(phase), JSON.stringify(final));
  }
  assert.deepEqual(session.errors, []);
  assert.deepEqual(session.assetErrors, []);
  console.log("Validado: diálogos, leitura automática e abertura das portas revelando os dois trechos da sombra do boss.");
} finally { await session.fechar(); }
