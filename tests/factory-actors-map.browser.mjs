/** Colisões seletivas, contorno do mapa e trocadecamada01 independente no Phaser real. */
import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false } });
const { page } = session;
try {
  const result = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atorNaRegiaoTroca } = await import("/js/map/TrocaCamada.js");
    const { criarRobos, criarRoboSerra } = await import("/js/enemies/EnemyTest.js");
    criarRobos(scene, 1);
    const enemy = scene.inimigos[0];
    const saw = criarRoboSerra(scene);
    const pet = scene.companionPet;
    const actors = [scene.player, pet, enemy, saw];
    for (const actor of actors) { actor.setVelocity(0, 0); actor.anims.stop(); }
    // Coloca os contatos físicos com o chão, sem depender da margem transparente do sprite.
    function place(actor, x, footY) {
      actor.body.updateFromGameObject();
      const dx = x - actor.body.center.x, dy = footY - actor.body.bottom;
      actor.body.reset(actor.x + dx, actor.y + dy);
      actor.body.updateFromGameObject();
    }
    const wall = scene.objetosMapaParte2.filter(o => o.getData("objectLayerName") === "ParedePortaBoss");
    const reader = scene.objetosMapaParte2.find(o => o.getData("objectLayerName") === "Leitordecartão");
    place(scene.player, -1155, -5260);
    place(pet, -1080, -5220);
    place(enemy, -1000, -5280);
    place(saw, -1220, -5200);
    scene.cameras.main.stopFollow();
    scene.cameras.main.setZoom(1.5).centerOn(-1090, -5270);
    const update = () => {
      scene.events.emit("postupdate");
      scene.children.depthSort();
    };
    update();
    const before = { wall: wall.map(o => o.depth), reader: reader.depth, actors: actors.map(o => o.depth) };
    place(scene.player, -1155, -5140);
    update();
    const after = { wall: wall.map(o => o.depth), reader: reader.depth, actors: actors.map(o => o.depth) };
    // O companheiro atravessa a parede; jogador e inimigos continuam colidindo.
    const obstacle = scene.collisionGroup.create(-1080, -5600)
      .setDisplaySize(200, 16).refreshBody().setVisible(false);
    const collisions = [];
    for (const actor of actors) {
      for (const other of actors) place(other, 6000 + actors.indexOf(other) * 200, 6000);
      place(actor, -1080, obstacle.body.top - 10);
      const start = actor.body.bottom;
      actor.setVelocity(0, 100);
      let blocked = false;
      for (let frame = 0; frame < 60; frame++) {
        scene.physics.world.update(frame * 1000 / 60, 1000 / 60);
        scene.physics.world.postUpdate();
        blocked ||= actor.body.blocked.down;
      }
      collisions.push({ start, foot: actor.body.bottom, wall: obstacle.body.top,
        overlap: Phaser.Geom.Intersects.RectangleToRectangle(actor.body, obstacle.body),
        blocked, immovable: actor.body.immovable });
      actor.setVelocity(0, 0);
    }
    obstacle.destroy();
    const region = scene.regiaoTrocaCamada;
    const originalDepths = scene.camadasMapaParte2.map(layer => layer.depth);
    const triggerStates = [];
    for (const playerInside of [false, true]) for (const petInside of [false, true]) {
      place(scene.player, -580, playerInside ? region.top + 50 : region.bottom + 30);
      place(pet, -460, petInside ? region.top + 50 : region.bottom + 30);
      update();
      scene.atualizarInteracaoPortaFabrica();
      triggerStates.push({ playerInside, petInside,
        player: atorNaRegiaoTroca(scene, scene.player), pet: atorNaRegiaoTroca(scene, pet),
        playerDepth: scene.player.depth, petDepth: pet.depth,
        layers: scene.camadasMapaParte2.map(layer => layer.depth), doorDepth: scene.portaFabrica.visual.depth,
        onMap: pet.areaMapa.contem(pet.body) });
    }
    const boundaries = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      place(pet, -460, region.top + 50);
      update();
      let x = pet.body.center.x, foot = pet.body.bottom;
      for (let step = 0; step < 1000; step++) {
        const candidate = { x: x + dx * 48 - pet.body.width / 2,
          y: foot + dy * 48 - pet.body.height, width: pet.body.width, height: pet.body.height };
        if (!pet.areaMapa.contem(candidate)) break;
        x += dx * 48; foot += dy * 48;
      }
      place(pet, x, foot); update();
      pet.setVelocity(dx * 1000, dy * 1000);
      let stayedOnMap = true;
      for (let frame = 0; frame < 20; frame++) {
        scene.physics.world.update(frame * 1000 / 60, 1000 / 60);
        scene.physics.world.postUpdate();
        update();
        stayedOnMap &&= pet.areaMapa.contem(pet.body);
      }
      boundaries.push({ dx, dy, stayedOnMap });
      pet.setVelocity(0, 0);
    }
    place(scene.player, -580, region.top + 50);
    place(pet, -460, region.bottom + 30);
    update();
    scene.cameras.main.setZoom(1.5).centerOn(-530, region.top + 50);
    return { before, after, collisions, triggerStates, originalDepths, boundaries };
  });
  for (const state of [result.before, result.after]) {
    assert.equal(state.wall[0], state.wall[1], "blocos da parede permanecem juntos");
    assert.ok(state.actors[2] < state.wall[0], "robô acima continua atrás da parede");
    assert.ok(state.actors[1] > state.reader, "amigo abaixo fica à frente");
    assert.ok(state.actors[3] > state.reader, "robô-serra abaixo fica à frente");
  }
  assert.ok(result.before.actors[0] < result.before.wall[0]);
  assert.ok(result.after.actors[0] > result.after.reader);
  for (const [index, collision] of result.collisions.entries()) {
    assert.ok(collision.foot > collision.start + 5, `ator ${index} realmente caminhou`);
    if (index === 1) {
      assert.ok(collision.foot > collision.wall + 50, "companheiro atravessa o obstáculo interno");
      assert.equal(collision.blocked, false);
    } else {
      assert.ok(collision.foot <= collision.wall + 0.1, `ator ${index} mantém colisão`);
      assert.ok(collision.blocked, `ator ${index} detectou o obstáculo`);
    }
  }
  for (const state of result.triggerStates) {
    assert.equal(state.player, state.playerInside);
    assert.equal(state.pet, state.petInside);
    assert.equal(state.playerDepth < 6, state.playerInside);
    assert.equal(state.petDepth < 6, state.petInside);
    assert.ok(state.onMap);
    assert.deepEqual(state.layers, result.originalDepths, "o gatilho não reordena o mapa inteiro");
    assert.equal(state.doorDepth, result.triggerStates[0].doorDepth, "o jogador não altera a moldura dos outros");
  }
  for (const boundary of result.boundaries) assert.ok(boundary.stayedOnMap, JSON.stringify(boundary));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/factory-player-inside-pet-outside.png" });
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2"), region = scene.regiaoTrocaCamada;
    for (const [actor, foot] of [[scene.player, region.bottom + 30], [scene.companionPet, region.top + 50]]) {
      actor.body.reset(actor.x, actor.y + foot - actor.body.bottom);
      actor.body.updateFromGameObject();
    }
    scene.events.emit("postupdate"); scene.children.depthSort();
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "/tmp/factory-pet-inside-player-outside.png" });
  assert.deepEqual(session.errors, []);
  console.log("PASS: companheiro atravessa paredes sem sair do mapa; jogador e robô ativam trocadecamada01 independentemente.");
} finally {
  await session.fechar();
}
