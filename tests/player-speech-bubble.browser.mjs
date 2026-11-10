/** Digitação e crescimento real da caixa, com DOM nítido e fallback Phaser. */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const context = await browser.newContext({ viewport: { width: 932, height: 430 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/speech-bubble-test", route => route.fulfill({ contentType: "text/html", body: `
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>html,body{margin:0;background:#14202b;height:100%}#game-container{position:fixed;inset:0}</style>
    <div id="game-container"></div><script src="/js/libs/phaser.min.js"></script>
    <script type="module">
    import {criarFalaFlutuante} from '/js/ui/PlayerSpeechBubble.js';
    new Phaser.Game({type:Phaser.CANVAS,parent:'game-container',width:800,height:450,
      scale:{mode:Phaser.Scale.EXPAND},dom:{createContainer:true},audio:{noAudio:true},scene:{create(){
        this.cameras.main.setBackgroundColor('#14202b');this.personagemSelecionada='kai-mercer';
        this.player=this.add.rectangle(300,330,28,48,0x38bdf8).setOrigin(.5,1);
        this.fala=criarFalaFlutuante(this);
        this.events.on('prerender',()=>this.fala.atualizar());window.s=this;
      }}});</script>` }));
  await page.goto((process.env.BASE_URL ?? "http://127.0.0.1:8765") + "/speech-bubble-test");
  await page.waitForFunction(() => !!window.s?.fala);
  const frase = "Preciso encontrar o cartão de acesso. Vou procurar por aqui.";
  const snapshot = () => page.evaluate(() => {
    const node = document.querySelector("[data-player-speech-bubble]");
    return { text: window.s.fala.texto.text, width: node.clientWidth, height: node.clientHeight,
      domText: node.firstChild.textContent.replace(/\s+/g, " ").trim() };
  });
  await page.evaluate(frase => window.s.fala.mostrar(frase), frase);
  const samples = [await snapshot()];
  assert.ok(samples[0].text.length < frase.length);
  await page.waitForTimeout(150);
  await page.screenshot({ path: "/tmp/player-speech-start.png" });
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(100);
    samples.push(await snapshot());
  }
  await page.waitForFunction(frase => window.s.fala.texto.text === frase, frase);
  samples.push(await snapshot());
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i].text.startsWith(samples[i - 1].text), "a frase aparece em ordem");
    assert.ok(samples[i].width >= samples[i - 1].width, "a caixa não encolhe ao quebrar uma palavra");
    assert.ok(samples[i].height >= samples[i - 1].height, "novas linhas fazem a caixa crescer");
  }
  const full = samples.at(-1);
  assert.equal(full.domText, frase);
  assert.ok(full.width > samples[0].width && full.height > samples[0].height);
  await page.screenshot({ path: "/tmp/player-speech-full.png" });
  const small = await page.evaluate(() => {
    window.s.fala.mostrar("Oi");
    const node = document.querySelector("[data-player-speech-bubble]");
    return { text: window.s.fala.texto.text, width: node.clientWidth, height: node.clientHeight };
  });
  assert.equal(small.text, "O");
  assert.ok(small.width < full.width && small.height < full.height);
  await page.evaluate(() => window.s.fala.ocultar());
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.s.fala.texto.text), "O");

  // Sem DOM, a caixa Phaser também cresce e mostra o texto progressivamente.
  const fallback = await page.evaluate(async () => {
    const { criarFalaFlutuante } = await import('/js/ui/PlayerSpeechBubble.js');
    const s = window.s, addDOM = s.add.dom;
    s.add.dom = null;
    const fala = criarFalaFlutuante(s, 'speech-fallback');
    s.add.dom = addDOM;
    fala.mostrar('Texto sem DOM, letra por letra.');
    window.fallback = fala;
    s.events.on('prerender', () => fala.atualizar());
    return { text: fala.texto.text, width: fala.texto.width };
  });
  assert.equal(fallback.text, 'T');
  await page.waitForFunction(() => window.fallback.texto.text === 'Texto sem DOM, letra por letra.');
  assert.ok(await page.evaluate(width => window.fallback.texto.width > width, fallback.width));
  assert.deepEqual(errors, []);
  console.log("PASS: letras progressivas, crescimento sem encolher, quebra de linhas, reinício pequeno e fallback Phaser.");
} finally {
  await browser.close();
}
