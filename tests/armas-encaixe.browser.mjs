/** Compõe os pixels reais no Phaser, guarda antes/depois e mede grip/cano por matriz. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
const pasta = process.env.ARMAS_CAPTURAS ?? "/tmp/encaixe-armas/browser";
await mkdir(pasta, { recursive: true });
const resultados = [];
const baseline = process.env.ARMAS_BASELINE ?? "/tmp/encaixe-armas/antes";
const temBaseline = await access(baseline).then(() => true).catch(() => false);
try {
  for (const versao of (temBaseline ? ["antes", "depois"] : ["depois"])) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const erros = [];
    page.on("pageerror", e => erros.push(e.message));
    if (versao === "antes") {
      for (const nome of ["ArmaPersonagemTeste", "PersonagemTeste", "EspadaPersonagemTeste", "FloretePersonagemTeste"]) {
        const body = await readFile(`${baseline}/js/player/${nome}.js`, "utf8");
        await page.route(`**/js/player/${nome}.js`, route => route.fulfill({ contentType: "text/javascript", body }));
      }
    }
    await page.goto((process.env.BASE_URL ?? "http://127.0.0.1:8765") + "/debug/armas.html");
    await page.waitForFunction(() => window.__armasScene?.armaPersonagemTeste, null, { timeout: 60000 });
    await page.evaluate(() => { window.__armasScene.scene.pause(); });
    async function pose(arma, animacao, quadro, angulo, tempo = null) {
      return page.evaluate(async ({ arma, animacao, quadro, angulo, tempo }) => {
        const s = window.__armasScene;
        const { atualizarArmaPersonagemTeste } = await import("/js/player/ArmaPersonagemTeste.js");
        document.getElementById("arma").value = arma;
        document.getElementById("animacao").value = animacao;
        document.getElementById("quadro").value = quadro;
        s.configurar();
        s.armaPersonagemTeste.direcao = { x: Math.cos(angulo), y: Math.sin(angulo) };
        s.debugEncaixeArmas = false;
        atualizarArmaPersonagemTeste(s, 0);
        if (tempo !== null) {
          s.atacar();
          // Avança em passos pequenos: exercita o mesmo relógio de golpes do jogo.
          for (let t = 0; t < tempo; t += 10) {
            s.time.now += Math.min(10, tempo - t);
            atualizarArmaPersonagemTeste(s, 0);
          }
        }
        s.children.depthSort();
        const e = s.armaPersonagemTeste, p = e.pose, c = e.config;
        // A matriz é centrada no origin do GameObject: testa pontos locais centrados.
        const matriz = e.sprite.getWorldTransformMatrix();
        const realGrip = matriz.transformPoint(0, 0);
        const dx = (c.cano.x - c.empunhadura.x), dy = (c.cano.y - c.empunhadura.y) * (e.sprite.flipY ? -1 : 1);
        const realCano = matriz.transformPoint(dx, dy);
        return { arma, animacao, quadro, angulo, tempo, medido: p.socketMedido ?? false,
          mao: p.mao, socket: p.socket ?? null, grip: { x: realGrip.x, y: realGrip.y },
          cano: p.cano, realCano: { x: realCano.x, y: realCano.y },
          corpo: { x: s.player.x, y: s.player.y, depth: s.player.depth }, depth: e.sprite.depth,
          vida: s.vida, golpe: Boolean(e.golpeEspada ?? e.estocada) };
      }, { arma, animacao, quadro, angulo, tempo });
    }
    const armas = await page.locator("#arma option").evaluateAll(os => os.map(o => o.value));
    for (const arma of armas) {
      for (const [animacao, n] of [["idle", 8], ["walk", 16]]) {
        for (const angulo of [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI,
          -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4]) {
          for (let quadro = 0; quadro < n; quadro++) {
            const r = await pose(arma, animacao, quadro, angulo);
            if (versao === "depois") {
              assert.ok(r.medido);
              assert.ok(Math.hypot(r.grip.x - r.mao.x, r.grip.y - r.mao.y) < 0.001);
              assert.ok(Math.hypot(r.realCano.x - r.cano.x, r.realCano.y - r.cano.y) < 0.001);
              if (Math.sin(angulo) < -0.2) assert.ok(r.depth < r.corpo.depth);
              if (Math.sin(angulo) > 0.1) assert.ok(r.depth > r.corpo.depth);
            }
            resultados.push({ versao, ...r });
            if (animacao === "walk" && angulo === 0) {
              const frame = await page.evaluate(() => window.__armasGame.loop.frame);
              await page.waitForFunction(f => window.__armasGame.loop.frame >= f + 2, frame);
              await page.locator("canvas").screenshot({ path: `${pasta}/${versao}-${arma}-walk-${String(quadro).padStart(2, "0")}.png` });
            }
          }
        }
      }
      for (const [nome, animacao, quadro, angulo, tempo] of [
        ["idle-direita", "idle", 0, 0, null], ["walk-direita", "walk", 9, 0, null],
        ["idle-cima", "idle", 0, -Math.PI / 2, null],
        ["ataque", "idle", 0, 0, 180], ["ataque-esquerda", "walk", 9, Math.PI, 180]]) {
        const r = await pose(arma, animacao, quadro, angulo, tempo);
        resultados.push({ versao, ...r });
        const f = await page.evaluate(() => window.__armasGame.loop.frame);
        await page.waitForFunction(f => window.__armasGame.loop.frame >= f + 2, f);
        await page.locator("canvas").screenshot({ path: `${pasta}/${versao}-${arma}-${nome}.png` });
      }
    }
    if (versao === "depois") {
      // Recuo medido durante caminhada: cano renderizado e ponto de emissão continuam coincidentes.
      for (const tempo of [0, 20, 45, 70, 90]) {
        const r = await pose("rifle-teste", "walk", 5, Math.PI / 5, tempo);
        assert.ok(Math.hypot(r.realCano.x - r.cano.x, r.realCano.y - r.cano.y) < 0.001);
        assert.ok(Math.hypot(r.grip.x - r.mao.x, r.grip.y - r.mao.y) < 0.001);
      }
      for (const passos of [0, 8, 16]) {
        await pose("rifle-teste", "idle", 0, Math.PI / 12);
        await page.evaluate(passos => {
          document.getElementById("rotacao").value = passos;
          document.getElementById("angulo").value = 15;
          window.__armasScene.update(0, 0);
          window.__armasScene.events.emit("postupdate", 0, 0);
        }, passos);
        const frame = await page.evaluate(() => window.__armasGame.loop.frame);
        await page.waitForFunction(f => window.__armasGame.loop.frame >= f + 2, frame);
        await page.locator("canvas").screenshot({ path: `${pasta}/rotacao-${passos}.png` });
      }
    }
    assert.deepEqual(erros, []);
    console.log(`PASS ${versao}: ${armas.length} armas, 24 quadros por arma, oito direções e capturas de ataque.`);
    await page.close();
  }
  await writeFile(pasta + "/medicoes.json", JSON.stringify(resultados, null, 2));
} finally { await browser.close(); }
