/** Galões DEV por toque e rótulos HTML durante fades reais da câmera. */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const context = await browser.newContext({ viewport: { width: 932, height: 430 },
    hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/dev-inventory-fuel-test", route => route.fulfill({ contentType: "text/html", body: `
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>html,body{margin:0;height:100%;background:#000}#game-container{position:fixed;inset:0}</style>
    <div id="game-container"></div><script src="/js/libs/phaser.min.js"></script>
    <script type="module">
    import {Inventory} from '/js/inventory/Inventory.js';
    import {InventoryUI} from '/js/inventory/InventoryUI.js';
    import {listInventoryItems,preloadInventoryItemImages,createBuiltinInventoryTextures} from '/js/inventory/InventoryItems.js';
    import {criarMenuColetaveisDev} from '/js/controls/DeveloperItemMenu.js';
    new Phaser.Game({type:Phaser.CANVAS,parent:'game-container',width:800,height:450,
      scale:{mode:Phaser.Scale.EXPAND},dom:{createContainer:true},audio:{noAudio:true},scene:{
      preload(){this.load.setPath('/assets/');preloadInventoryItemImages(this);},
      create(){
        createBuiltinInventoryTextures(this);this.cameras.main.setBackgroundColor('#284454');
        this.developerMode=true;this.personagemSelecionada='kai-mercer';
        this.player={active:true,setVelocity(){}};
        this.inventoryItems=new Map(listInventoryItems().map(i=>[i.id,i]));
        this.inventory=new Inventory({});this.inventory.addItem('gasolina');this.inventory.fillFuel(.35);
        this.inventoryUI=new InventoryUI(this,this.inventory);criarMenuColetaveisDev(this);window.s=this;
      }
    }});</script>` }));
  await page.goto((process.env.BASE_URL ?? "http://127.0.0.1:8765") + "/dev-inventory-fuel-test");
  await page.waitForFunction(() => window.s?.inventoryUI);
  await page.keyboard.press("i");
  await page.waitForFunction(() => window.s.devItemMenuOpen);
  async function tocarBotao(name) {
    const point = await page.evaluate(name => {
      const s = window.s, modal = s.children.list.find(o => o.depth === 10000);
      const b = modal.getByName(name), r = s.game.canvas.getBoundingClientRect();
      if (!b) throw new Error('Botão ausente: ' + name);
      return { x: r.x + (s.cameras.main.width / 2 + b.x) * r.width / s.scale.width,
        y: r.y + (s.cameras.main.height / 2 + b.y) * r.height / s.scale.height };
    }, name);
    await page.touchscreen.tap(point.x, point.y);
  }
  await tocarBotao("dev-item:gasolina:1");
  await tocarBotao("dev-item:gasolina:1:cheio");
  assert.deepEqual(await page.evaluate(() => window.s.inventory.getSlots().map(s => s.fuel)), [0.35, 0, 1]);
  await page.screenshot({ path: "/tmp/dev-inventory-fuel.png" });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !window.s.devItemMenuOpen);
  const labels = page.locator("[data-inventory-fuel-label]");
  assert.deepEqual(await labels.allTextContents(), ["35%", "0%", "100%"]);
  await page.evaluate(() => window.s.cameras.main.fadeOut(200, 0, 0, 0));
  await page.waitForFunction(() => window.s.cameras.main.fadeEffect.alpha === 1);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-inventory-fuel-label]')]
    .every(node => getComputedStyle(node).display === 'none' || Number(getComputedStyle(node).opacity) === 0));
  await page.screenshot({ path: "/tmp/dev-inventory-fuel-fade.png" });
  await page.evaluate(() => window.s.cameras.main.fadeIn(200, 0, 0, 0));
  await page.waitForFunction(() => window.s.cameras.main.fadeEffect.alpha === 0);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-inventory-fuel-label]')]
    .every(node => getComputedStyle(node).display !== 'none' && Number(getComputedStyle(node).opacity) === 1));
  assert.deepEqual(await labels.allTextContents(), ["35%", "0%", "100%"]);
  assert.deepEqual(errors, []);
  console.log("PASS: DEV concede galões 0% e 100% por toque sem alterar o parcial; porcentagens somem no fade e retornam depois.");
} finally {
  await browser.close();
}
