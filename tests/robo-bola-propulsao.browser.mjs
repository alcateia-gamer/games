/** Áudio real responde a ações e posição; a física continua levitando normalmente. */
import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
});
try {
  const result = await session.page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { criarRoboBola, atualizarRoboBola } = await import("/js/enemies/RoboBola.js");
    const { ROBO_BOLA_FLUTUACAO: flutuacao } = await import("/js/enemies/RoboBolaFlutuacao.js");
    const key = "robo-bola-propulsao";
    if (!s.cache.audio.exists(key)) throw new Error("MP3 da propulsão não foi carregado");
    const r = criarRoboBola(s);
    if (!r) throw new Error("Não foi possível criar o robô-bola");
    r.faseFlutuacao = 0; r.spawnProtegidoAte = Infinity;
    const audio = (delta = 20) => s.events.emit("postupdate", 0, delta);
    const avancar = (n = 30) => { for (let i = 0; i < n; i++) audio(); };
    const tick = time => { atualizarRoboBola(s, time, 0); audio(50); };
    tick(0);
    for (let i = 0; i < 11; i++) {
      audio(50);
      if (s.sound.get(key)) throw new Error("propulsão tocou durante o nascimento");
    }
    tick(0);
    const sound = s.sound.get(key);
    const inicial = { playing: sound.isPlaying, rate: sound.rate, detune: sound.detune,
      loop: sound.loop, duration: sound.totalDuration };
    tick(flutuacao.periodoMs / 4);
    const visualBaixo = r.getBounds().centerY;
    r.body.updateFromGameObject(); const corpoBaixo = r.body.center.y;
    const quieto = sound.currentConfig.volume;
    tick(flutuacao.periodoMs * 0.3);
    const subida = sound.currentConfig.volume;
    avancar(70); const depois = sound.currentConfig.volume;
    r.setVelocity(120, 0); audio(); const arranque = sound.currentConfig.volume;
    avancar(40); const cruzeiro = sound.currentConfig.volume;
    r.setVelocity(0, -120); audio(); const curva = sound.currentConfig.volume;
    r.setVelocity(0, 0);
    tick(flutuacao.periodoMs * 3 / 4);
    const visualAlto = r.getBounds().centerY;
    r.body.updateFromGameObject(); const corpoAlto = r.body.center.y;
    avancar(80);
    const original = { x: r.x, y: r.y };
    const listener = s.player.body.center;
    r.setPosition(listener.x + 80, listener.y - r.deslocamentoFlutuacao); audio(); avancar();
    const perto = { volume: sound.currentConfig.volume, pan: sound.currentConfig.pan };
    r.setPosition(listener.x + 300, listener.y - r.deslocamentoFlutuacao); audio(); avancar();
    const longe = sound.currentConfig.volume;
    r.setPosition(listener.x - 80, listener.y - r.deslocamentoFlutuacao); audio(); avancar();
    const esquerda = sound.currentConfig.pan;
    r.setPosition(listener.x + 100, listener.y - r.deslocamentoFlutuacao); audio();
    r.setVelocity(-150, 0); avancar(40); const aproxima = sound.detune;
    r.setVelocity(150, 0); avancar(40); const afasta = sound.detune;
    r.setVelocity(0, 0); avancar(70); const pairando = sound.detune;
    r.setPosition(listener.x + 700, listener.y); audio(); const distante = sound.isPlaying;
    r.setPosition(original.x, original.y); audio(); const retomou = sound.isPlaying;
    s.events.emit("pause"); const pausou = sound.isPaused;
    s.events.emit("resume");
    window.__roboBolaFlutuando = r;
    window.__flutuacaoAoVivo = [];
    window.__registrarFlutuacao = () => window.__flutuacaoAoVivo.push({
      visual: r.getBounds().centerY - r.y, corpo: r.body.center.y - r.y,
    });
    s.events.on("postupdate", window.__registrarFlutuacao);
    return { inicial, quieto, subida, depois, arranque, cruzeiro, curva,
      visualBaixo, visualAlto, corpoBaixo, corpoAlto, perto, longe, esquerda,
      aproxima, afasta, pairando, distante, retomou, pausou };
  });
  assert.equal(result.inicial.playing, true); assert.equal(result.inicial.detune, -600);
  assert.equal(result.inicial.rate, 1); assert.equal(result.inicial.loop, true);
  assert.ok(result.inicial.duration > 8);
  assert.ok(result.subida > result.quieto * 5, JSON.stringify(result));
  assert.ok(result.depois < result.subida / 10, "altura estática não mantém rajadas artificiais");
  assert.ok(result.arranque > result.depois * 5);
  assert.ok(result.curva > result.cruzeiro * 2);
  assert.ok(result.visualBaixo - result.visualAlto >= 26);
  assert.ok(Math.abs(result.corpoBaixo - result.corpoAlto) < 0.01);
  assert.ok(result.perto.volume > result.longe * 10);
  assert.ok(result.perto.pan > 0.5 && result.esquerda < -0.5, JSON.stringify(result));
  assert.ok(result.aproxima > result.afasta + 40);
  assert.ok(result.afasta > result.inicial.detune + 150, "deslocamento afina a propulsão");
  assert.ok(Math.abs(result.pairando + 600) < 2, "volta ao grave ao pairar");
  assert.equal(result.distante, false); assert.equal(result.retomou, true); assert.equal(result.pausou, true);
  await session.retomar();
  await session.page.waitForTimeout(2200);
  const live = await session.page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), r = window.__roboBolaFlutuando;
    s.events.off("postupdate", window.__registrarFlutuacao);
    const samples = window.__flutuacaoAoVivo;
    const amplitude = key => Math.max(...samples.map(a => a[key])) - Math.min(...samples.map(a => a[key]));
    r.morto = true; s.events.emit("postupdate");
    const destruido = s.sound.get("robo-bola-propulsao")?.pendingRemove ?? true;
    r.destroy();
    return { amostras: samples.length, amplitudeVisual: amplitude("visual"), variacaoCorpo: amplitude("corpo"), destruido };
  });
  assert.ok(live.amostras >= 5, JSON.stringify(live));
  assert.ok(live.amplitudeVisual >= 24, JSON.stringify(live));
  assert.ok(live.variacaoCorpo < 0.1, JSON.stringify(live));
  assert.equal(live.destruido, true); assert.deepEqual(session.errors, []);
  console.log("PASS: som grave reage a subida/manobras e à perspectiva de distância, estéreo e Doppler; levitação e colisão estáveis.");
} finally {
  await session.fechar();
}
