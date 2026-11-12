/** Executar com um servidor HTTP do repositório e Playwright/Chromium disponíveis. */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    const { criarFixtureAudio } = await import("/tests/multiplayer-audio-fixture.mjs");
    window.__audioFixture = await criarFixtureAudio();
  });
  await page.locator("#audio-fixture-unlock").click({ force: true });
  const report = await page.evaluate(async () => {
    const f = window.__audioFixture;
    f.startMusic();
    f.peers[1].scene.sound.play("running", { loop: true, volume: .3 });
    f.peers[0].scene.sound.play("robo-explodindo", { volume: .13 });
    await f.wait(700);
    const initial = { running: f.report("running"), music: f.report("musica-cidade"),
      explosion: f.report("robo-explodindo") };
    const step = [...f.peers[1].runtime.audio.local.values()].find(s => s.key === "running").proxy;
    step.pause(); await f.wait(200); const paused = f.report("running");
    step.resume(); await f.wait(300); const resumed = f.report("running");
    step.stop(); await f.wait(200); const stopped = f.report("running");
    return { initial, paused, resumed, stopped, errors: f.errors };
  });
  for (const key of ["running", "music", "explosion"]) for (const peer of report.initial[key]) {
    assert.equal(peer.state, "running"); assert.equal(peer.locked, false);
    assert.equal(peer.sounds.length, 1); assert.equal(peer.sounds[0].playing, true);
    assert.ok(peer.sounds[0].volume > 0);
  }
  const positions = report.initial.music.map(p => p.sounds[0].seek);
  assert.ok(Math.max(...positions) - Math.min(...positions) < .15);
  assert.ok(report.paused.every(p => p.sounds.every(s => s.paused)));
  assert.ok(report.resumed.every(p => p.sounds.some(s => s.playing)));
  assert.ok(report.stopped.every(p => p.sounds.every(s => !s.playing && !s.paused)));
  assert.deepEqual(report.errors, []); assert.deepEqual(errors, []);
  console.log("PASS: quatro Phaser/WebAudio reais; música, efeitos, pausa, retomada e parada.");
} finally {
  await page.evaluate(() => window.__audioFixture?.destroy()).catch(() => {});
  await browser.close();
}
