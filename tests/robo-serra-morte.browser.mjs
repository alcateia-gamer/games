/** Recorte real, orientação visível, golpe fatal e animação completa no Phaser. */
import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
});
const { page } = session;
try {
  const report = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { criarInimigoTeste } = await import("/js/enemies/EnemyTest.js");
    const { destruirInimigoTeste, causarDanoInimigo } = await import("/js/enemies/EnemyHealth.js");
    const { describeVisual } = await import("/js/multiplayer/CoopVisuals.js");
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const explosions = [];
    const playSound = s.sound.play.bind(s.sound);
    s.sound.play = (key, config) => {
      if (key === "robo-explodindo") explosions.push(config.volume);
      return playSound(key, config);
    };
    const texture = s.textures.get("robo-serra-morte");
    check(texture.getFrameNames().length === 16, "deve recortar exatamente 16 quadros");
    for (let i = 0; i < 16; i++) {
      const f = texture.get(i);
      check(f.cutWidth === 278 && f.cutHeight === 270, `tamanho do quadro ${i}`);
      check(f.cutX === (i % 4) * 278 && f.cutY === Math.floor(i / 4) * 270, `recorte do quadro ${i}`);
    }
    const geometry = r => [r.x, r.y, r.scaleX, r.scaleY, r.originX, r.originY,
      r.displayWidth, r.displayHeight, r.flipX, r.depth];
    const results = [];
    for (let liveFrame = 0; liveFrame < 20; liveFrame++) {
      const direction = ["up", "down", "left", "right"][Math.floor(liveFrame / 5)];
      const start = { down: 0, up: 4, left: 8, right: 12 }[direction];
      const r = criarInimigoTeste(s, { tipoRobo: "serra", remoteOnly: true,
        x: s.player.x + 120, y: s.player.y, direcaoAtual: direction === "down" ? "up" : "down" });
      r.setFrame(liveFrame); r.setTint(0xff5555);
      const before = geometry(r);
      destruirInimigoTeste(s, r);
      check(r.direcaoMorte === direction, `direção visível do frame ${liveFrame}`);
      check(r.texture.key === "robo-serra-morte" && r.frame.name === start, `primeiro frame ${liveFrame}`);
      check(JSON.stringify(geometry(r)) === JSON.stringify(before), `explosão não deve saltar/redimensionar: ${liveFrame}`);
      check(r.body.enable === false && r.hitboxDano === null && !s.inimigos.includes(r), "cadáver sai do combate");
      check(!r.isTinted && r.alpha === 1 && r.fundoVida === null, "cores e visibilidade da folha");
      const replica = describeVisual(r);
      check(replica.k === "robo-serra-morte" && replica.f === start, "réplica preserva textura e direção");
      const seen = [r.frame.name];
      r.on("animationupdate", () => {
        seen.push(r.frame.name);
        check(JSON.stringify(geometry(r)) === JSON.stringify(before), `geometria mudou na explosão ${liveFrame}`);
      });
      destruirInimigoTeste(s, r);
      let elapsed = 0;
      while (r.active && elapsed < 1600) { elapsed += 10; r.anims.update(elapsed, 10); }
      check(!r.active && !r.scene, `remove somente depois de terminar: ${liveFrame}`);
      check(JSON.stringify([...new Set(seen)]) === JSON.stringify([start, start + 1, start + 2, start + 3]), `fileira incompleta: ${seen}`);
      check(elapsed >= 520 && elapsed <= 570, `duração da explosão: ${elapsed}`);
      results.push({ liveFrame, direction, seen: [...new Set(seen)], elapsed });
    }
    // Exercita o caminho real do golpe fatal, que cria recuo, flash e squash antes da morte.
    const r = criarInimigoTeste(s, { tipoRobo: "serra", remoteOnly: true,
      x: s.player.x + 140, y: s.player.y, direcaoAtual: "right" });
    r.anims.play("robo-serra-ataque-left");
    const before = geometry(r);
    causarDanoInimigo(s, r, 9999, { particles: 0 });
    check(r.direcaoMorte === "left", "ataque mantém a orientação visual, não a mira posterior");
    check(JSON.stringify(geometry(r)) === JSON.stringify(before), "golpe fatal restaura a escala e mantém a posição");
    check(s.tweens.getTweensOf(r).length === 0 && r.combatSquashBody === null, "não sobra tween de squash no cadáver");
    let elapsed = 0;
    while (r.active && elapsed < 1600) { elapsed += 10; r.anims.update(elapsed, 10); }
    check(!r.active, "finaliza a morte disparada pelo dano real");
    for (const [direction, start] of [["down", 0], ["left", 3], ["right", 6], ["up", 9]]) {
      const war = criarInimigoTeste(s, { tipoRobo: "padrao", remoteOnly: true,
        x: s.player.x + 120, y: s.player.y, direcaoAtual: direction });
      destruirInimigoTeste(s, war);
      const seen = [war.frame.name];
      war.on("animationupdate", () => seen.push(war.frame.name));
      destruirInimigoTeste(s, war);
      let elapsed = 0;
      while (war.active && elapsed < 1000) { elapsed += 10; war.anims.update(elapsed, 10); }
      check(!war.active, `morte do robô de guerra termina: ${direction}`);
      check(elapsed >= 320 && elapsed <= 360, `duração da morte do robô de guerra: ${elapsed}`);
      check(JSON.stringify([...new Set(seen)]) === JSON.stringify([start, start + 1, start + 2]), "preserva quadros do robô de guerra");
    }
    check(explosions.length === 25 && explosions.every(volume => volume === 0.13), "cada morte toca uma explosão no mesmo volume de 13%");
    s.sound.play = playSound;
    return results;
  });
  assert.equal(report.length, 20);
  assert.deepEqual(session.errors, []);
  console.log("PASS: serra ~536 ms e guerra ~330 ms nas quatro direções, todos os quadros preservados; explosão única por morte com volume de 13%; recortes e geometria preservados.");
} finally {
  await session.fechar();
}
