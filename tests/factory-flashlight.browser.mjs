/** Encaixe da lanterna na barriga, nas oito direções, no renderizador real. */
import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { ESCURIDAO_AMBIENTE_FABRICA } from "../js/effects/FactoryLighting.js";

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false } });
const { page } = session;
try {
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.definirIluminacaoFabrica(false);
    scene.cameras.main.stopFollow().setZoom(1.8).centerOn(scene.player.x, scene.player.y);
    const context = scene.textures.get("level1-parte2-escuridao").getContext();
    const draw = context.drawImage;
    context.drawImage = function (...args) {
      if (args[3] === 460 && args[4] === 320) {
        const matrix = this.getTransform();
        const camera = scene.cameras.main.matrix;
        // Retira a transformação da câmera para medir a origem efetiva em mundo.
        const det = camera.a * camera.d - camera.b * camera.c;
        const x = matrix.e - camera.e, y = matrix.f - camera.f;
        window.__flashlightDraw = {
          x: (camera.d * x - camera.c * y) / det,
          y: (-camera.b * x + camera.a * y) / det,
          angle: Math.atan2(matrix.b, matrix.a),
          frame: Number(scene.player.frame.name),
        };
        const velocity = scene.player.body.velocity;
        if (Math.hypot(velocity.x, velocity.y) > 1) {
          window.__flashlightLastMovingAngle = window.__flashlightDraw.angle;
        }
      }
      return draw.apply(this, args);
    };
  });
  const directions = [
    ["right", 1, 0, 27], ["down-right", 1, 1, 18], ["down", 0, 1, 18],
    ["down-left", -1, 1, 18], ["left", -1, 0, 9],
    ["up-left", -1, -1, 0], ["up", 0, -1, 0], ["up-right", 1, -1, 0],
  ];
  for (const [texture, size, originY] of [
    ["walk", 128, 64], ["personagem2-walk", 64, 32],
    ["personagem3-walk", 128, 68], ["personagem4-walk", 64, 32],
  ]) {
    for (const [name, dx, dy, frame] of directions) {
      for (const step of [0, 3]) {
        const expected = await page.evaluate(async ({ texture, size, originY, dx, dy, frame, step }) => {
          const scene = window.__game.scene.getScene("Level1Parte2");
          const { atualizarPoseLanterna } = await import("/js/effects/FlashlightPose.js");
          scene.player.anims.stop();
          scene.player.setTexture(texture, frame + step).setScale(1).setFlipX(false)
            .setDisplayOrigin(size / 2, originY).setVelocity(dx * 100, dy * 100);
          scene.direcaoAtual = dy ? (dy > 0 ? "down" : "up") : dx > 0 ? "right" : "left";
          return { ...atualizarPoseLanterna(scene, {}), frame: frame + step, behind: dy < 0 };
        }, { texture, size, originY, dx, dy, frame, step });
        await page.waitForFunction(expected => {
          const draw = window.__flashlightDraw;
          return draw && Math.hypot(draw.x - expected.x, draw.y - expected.y) < 0.001 &&
            Math.abs(draw.angle - expected.angulo) < 0.001 &&
            (!expected.behind || draw.frame === expected.frame);
        }, expected);
        const actual = await page.evaluate(() => window.__flashlightDraw);
        assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 0.001,
          `${texture}/${name}/${step}: o render deve nascer na barriga`);
        assert.ok(Math.abs(actual.angle - Math.atan2(dy, dx)) < 0.001);
        if (dy) {
          const shadow = await page.evaluate(() => {
            const scene = window.__game.scene.getScene("Level1Parte2");
            const player = scene.player, frame = player.frame;
            const source = document.createElement("canvas");
            source.width = frame.cutWidth;
            source.height = frame.cutHeight;
            const context = source.getContext("2d");
            context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
              0, 0, source.width, source.height);
            const pixels = context.getImageData(0, 0, source.width, source.height).data;
            const mask = scene.textures.get("level1-parte2-escuridao").getContext();
            const m = scene.cameras.main.matrix;
            const opaque = (x, y) => pixels[(y * source.width + x) * 4 + 3] === 255;
            let minAlpha = 1, count = 0, worst;
            for (let y = 2; y < source.height - 2; y++) for (let x = 2; x < source.width - 2; x++) {
              let interior = true;
              for (let oy = -2; oy <= 2 && interior; oy++) for (let ox = -2; ox <= 2; ox++) {
                if (!opaque(x + ox, y + oy)) { interior = false; break; }
              }
              if (!interior) continue;
              const wx = player.x + x + 0.5 + frame.x - player.displayOriginX;
              const wy = player.y + y + 0.5 + frame.y - player.displayOriginY;
              const sx = Math.floor(m.a * wx + m.c * wy + m.e);
              const sy = Math.floor(m.b * wx + m.d * wy + m.f);
              const alpha = mask.getImageData(sx, sy, 1, 1).data[3] / 255;
              if (alpha < minAlpha) { minAlpha = alpha; worst = { x, y, wx, wy, sx, sy }; }
              count++;
            }
            return { minAlpha, count, worst };
          });
          assert.ok(shadow.count > 10);
          if (dy < 0) assert.ok(shadow.minAlpha > ESCURIDAO_AMBIENTE_FABRICA - 2 / 255,
            `${texture}/${name}/${step}: o personagem fica na frente da lanterna (${JSON.stringify(shadow)})`);
          else assert.ok(shadow.minAlpha < ESCURIDAO_AMBIENTE_FABRICA - 0.1,
            `${texture}/${name}/${step}: o feixe passa sobre o personagem olhando para baixo`);
        }
      }
      const before = await page.evaluate(() => {
        const scene = window.__game.scene.getScene("Level1Parte2");
        scene.player.setVelocity(0, 0);
        return window.__flashlightDraw;
      });
      await page.waitForTimeout(50);
      assert.deepEqual(await page.evaluate(() => window.__flashlightDraw), before,
        `${texture}/${name}: parar mantém origem e mira`);
      if (texture === "walk") await page.screenshot({ path: `/tmp/flashlight-${name}.png` });
    }
  }
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.player.setTexture("walk", 18).setDisplayOrigin(64, 64).setVelocity(0, 0);
    scene.player.body.checkCollision.none = true;
  });
  await session.retomar();
  for (const [name, dx, dy] of directions) {
    const keys = [...(dx ? [dx > 0 ? "d" : "a"] : []), ...(dy ? [dy > 0 ? "s" : "w"] : [])];
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForFunction(({ dx, dy }) => {
      const v = window.__game.scene.getScene("Level1Parte2").player.body.velocity;
      return Math.abs(Math.atan2(v.y, v.x) - Math.atan2(dy, dx)) < 0.001 && Math.hypot(v.x, v.y) > 1;
    }, { dx, dy });
    const start = await page.evaluate(() => {
      const p = window.__game.scene.getScene("Level1Parte2").player;
      return { x: p.x, y: p.y };
    });
    await page.waitForTimeout(150);
    const moving = await page.evaluate(async () => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      const { atualizarPoseLanterna } = await import("/js/effects/FlashlightPose.js");
      return { x: scene.player.x, y: scene.player.y, draw: window.__flashlightDraw,
        belly: atualizarPoseLanterna(scene, {}) };
    });
    assert.ok(Math.hypot(moving.x - start.x, moving.y - start.y) > 1, `${name}: o personagem anda`);
    assert.ok(Math.hypot(moving.draw.x - moving.belly.x, moving.draw.y - moving.belly.y) < 0.001,
      `${name}: a luz acompanha a barriga durante o movimento pelo teclado`);
    await Promise.all(keys.map(key => page.keyboard.up(key)));
    await page.waitForFunction(() => {
      const v = window.__game.scene.getScene("Level1Parte2").player.body.velocity;
      return v.x === 0 && v.y === 0;
    });
    // Se os keyups caírem em quadros diferentes, a última direção pode ser cardinal.
    const stopped = await page.evaluate(() => ({ angle: window.__flashlightDraw.angle,
      lastMovingAngle: window.__flashlightLastMovingAngle }));
    assert.ok(Math.abs(stopped.angle - stopped.lastMovingAngle) < 0.001,
      `${name}: soltar WASD mantém a direção do feixe`);
  }
  await session.pausar();
  const sampleWorld = points => page.evaluate(points => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const context = scene.textures.get("level1-parte2-escuridao").getContext();
    const m = scene.cameras.main.matrix;
    return points.map(({x,y}) => context.getImageData(Math.floor(m.a*x + m.c*y + m.e),
      Math.floor(m.b*x + m.d*y + m.f), 1, 1).data[3] / 255);
  }, points);
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.player.setPosition(-840, -5120).setTexture("walk", 0).setDisplayOrigin(64,64).setVelocity(0,-100);
    scene.direcaoAtual = "up";
    scene.cameras.main.stopFollow().setRotation(0).setZoom(1.8).centerOn(-840,-5220);
  });
  await page.waitForFunction(() => Math.abs(window.__flashlightDraw.x + 840) < 0.001 &&
    Math.abs(window.__flashlightDraw.y + 5110) < 0.001 &&
    Math.abs(window.__flashlightDraw.angle + Math.PI/2) < 0.001);
  const wallPoints = [{x:-840,y:-5160}, {x:-840,y:-5230}, {x:-840,y:-5310}];
  let wallShadow = await sampleWorld(wallPoints);
  assert.ok(wallShadow[0] < ESCURIDAO_AMBIENTE_FABRICA - 0.1, "o chão antes da parede recebe luz");
  assert.ok(wallShadow[1] < ESCURIDAO_AMBIENTE_FABRICA - 0.1, "a face da parede recebe o feixe");
  assert.ok(Math.abs(wallShadow[2] - ESCURIDAO_AMBIENTE_FABRICA) < 2/255,
    "a parede real impede que a lanterna ilumine o outro lado");
  await page.screenshot({ path: "/tmp/flashlight-wall-blocked.png" });
  await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").cameras.main.setZoom(1.35).setRotation(0.12));
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").cameras.main.matrix.b > 0.01);
  wallShadow = await sampleWorld(wallPoints);
  assert.ok(wallShadow[0] < ESCURIDAO_AMBIENTE_FABRICA - 0.1);
  assert.ok(wallShadow[1] < ESCURIDAO_AMBIENTE_FABRICA - 0.1);
  assert.ok(Math.abs(wallShadow[2] - ESCURIDAO_AMBIENTE_FABRICA) < 2/255, "sombra acompanha zoom e rotação");

  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.player.setPosition(-1000,-5300).setTexture("walk",27).setDisplayOrigin(64,64).setVelocity(100,0);
    scene.direcaoAtual = "right";
    scene.cameras.main.setRotation(0).setZoom(1.8).centerOn(-950,-5290);
  });
  await page.waitForFunction(() => Math.abs(window.__flashlightDraw.x + 1000) < 0.001 &&
    Math.abs(window.__flashlightDraw.angle) < 0.001);
  const borderShadow = await sampleWorld([{x:-840,y:-5290}]);
  assert.ok(borderShadow[0] < ESCURIDAO_AMBIENTE_FABRICA - 0.1,
    "BordaAlta fica fora do bloqueio, sem apagar a luz atrás da faixa");

  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.player.setPosition(-1250,-4800).setTexture("walk",0).setDisplayOrigin(64,64).setVelocity(0,-100);
    scene.direcaoAtual = "up";
    scene.cameras.main.setRotation(0).setZoom(1.3).centerOn(-1250,-4900);
    const prop = scene.map.getObjectLayer("collision").objects.find(o => o.id === 518);
    if (!prop || prop.x > -1250 || prop.x + prop.width < -1250 ||
      prop.y > -4940 || prop.y + prop.height < -4940) throw new Error("O ponto de teste deve estar sobre a estrutura com colisão.");
  });
  await page.waitForFunction(() => Math.abs(window.__flashlightDraw.x + 1250) < 0.001 &&
    Math.abs(window.__flashlightDraw.y + 4790) < 0.001);
  const propShadow = await sampleWorld([{x:-1250,y:-4940}]);
  assert.ok(propShadow[0] < ESCURIDAO_AMBIENTE_FABRICA - 0.1,
    `a estrutura de produção continua iluminada sobre sua colisão (${propShadow[0]})`);
  await page.screenshot({ path: "/tmp/flashlight-objects-lit.png" });

  const door = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const a = scene.portaFabrica.area;
    const x = a.x + a.width/2, y = a.y + a.height + 48;
    scene.player.body.reset(x,y);
    scene.player.setTexture("walk",0).setDisplayOrigin(64,64).setVelocity(0,-100);
    scene.direcaoAtual = "up";
    scene.cameras.main.setRotation(0).setZoom(1.5).centerOn(x,a.y+a.height/2);
    return { x, y, faceY: a.y + a.height/2, targetY: a.y - 40 };
  });
  await page.waitForFunction(door => Math.abs(window.__flashlightDraw.y - door.y - 10) < 0.001 &&
    Math.abs(window.__flashlightDraw.angle + Math.PI/2) < 0.001, door);
  let doorShadow = await sampleWorld([{x:door.x,y:door.targetY}, {x:door.x,y:door.faceY}]);
  assert.ok(Math.abs(doorShadow[0] - ESCURIDAO_AMBIENTE_FABRICA) < 2/255, "porta fechada bloqueia a luz");
  assert.ok(doorShadow[1] < ESCURIDAO_AMBIENTE_FABRICA - 0.1, "a face da porta fechada também recebe luz");
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.player.setVelocity(0,0);
    scene.atualizarInteracaoPortaFabrica();
    if (!scene.interacaoMundoProxima?.interact()) throw new Error("A porta precisa abrir ao alcance do jogador.");
  });
  await session.retomar();
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").portaFabrica.estado === "aberta");
  await page.waitForTimeout(50);
  doorShadow = await sampleWorld([{x:door.x,y:door.targetY}]);
  assert.ok(doorShadow[0] < ESCURIDAO_AMBIENTE_FABRICA - 0.1,
    `abrir a porta deixa a luz passar sem mover o personagem (${doorShadow[0]})`);
  await page.screenshot({ path: "/tmp/flashlight-door-open.png" });
  assert.deepEqual(session.errors, []);
  console.log("Lanterna: paredes e objetos iluminados, sombra atrás das paredes, bordas excluídas, portas, zoom e rotação.");
} catch (error) {
  await page.screenshot({ path: "/tmp/flashlight-occlusion-error.png" });
  throw error;
} finally {
  await session.fechar();
}
