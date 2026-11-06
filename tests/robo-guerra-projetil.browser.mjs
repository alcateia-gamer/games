/** Valida emissores e física no Phaser real e gera uma prancha dos 12 quadros. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1050 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const pasta = process.env.ROBO_CAPTURAS ?? "/tmp/robo-guerra-capturas";
await mkdir(pasta, { recursive: true });
try {
  await page.route("**/robo-guerra-test", route => route.fulfill({ contentType: "text/html", body: `
    <style>body{margin:0;background:#17202c}canvas{display:block}</style>
    <script src="/js/libs/phaser.min.js"></script>
    <script>
    new Phaser.Game({type:Phaser.CANVAS,width:1200,height:1050,backgroundColor:'#17202c',
      audio:{noAudio:true},physics:{default:'arcade',arcade:{gravity:{y:0}}},scene:{
      preload(){
        for(const [key,file] of [['robo-teste','robo_teste_2'],['robo-teste-normal','robo_teste_3']])
          this.load.spritesheet(key,'/assets/PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_GUERRA/'+file+'.png',{frameWidth:311,frameHeight:421});
      },create(){window.s=this;this.physics.pause();this.sound.play=()=>{};this.scene.pause();}
    }});
    </script>` }));
  await page.goto((process.env.BASE_URL ?? "http://127.0.0.1:8765") + "/robo-guerra-test");
  await page.waitForFunction(() => window.s?.textures.exists("robo-teste"));
  const results = await page.evaluate(async () => {
    const { obterBocaMetralhadora, criarMunicaoRobo } = await import("/js/enemies/WarRobotProjectile.js");
    const { tentarDispararLaser } = await import("/js/enemies/EnemyLaser.js");
    const s = window.s, results = [];
    s.lasersInimigo = s.physics.add.group();
    const dirs = ['down','left','right','up'], angles = [Math.PI/2, Math.PI, 0, -Math.PI/2];
    for (const key of ['robo-teste', 'robo-teste-normal']) {
      for (let frame=0; frame<12; frame++) {
        const d=frame/3|0;
        const robo = s.physics.add.sprite(200,200,key,frame).setScale(.23).setDepth(12);
        Object.assign(robo,{direcaoAtual:dirs[d],ultimoLadoTiro:'left',ultimoTiro:0,tempoEntreTiros:720,velocidadeLaser:250});
        s.player={active:true,x:robo.x+Math.cos(angles[d])*300,y:robo.y+Math.sin(angles[d])*300};
        const shots=[];
        for(let i=0;i<3;i++) {
          const boca=obterBocaMetralhadora(robo);
          // Repõe a arma para que o fluxo real selecione essa mesma boca.
          robo.ultimoLadoTiro=i%2?'right':'left';
          tentarDispararLaser(s,(i+1)*720,robo);
          const laser=s.lasersInimigo.getChildren().at(-1);
          laser.body.updateFromGameObject();
          const rear=laser.getWorldTransformMatrix().transformPoint(-laser.displayOriginX,0);
          const vel=laser.body.velocity;
          const desired=Math.atan2(s.player.y-boca.y,s.player.x-boca.x);
          shots.push({boca,rear:{x:rear.x,y:rear.y},center:{x:laser.x,y:laser.y},
            body:{x:laser.body.center.x,y:laser.body.center.y},angle:Math.atan2(vel.y,vel.x),desired,
            behind:laser.depth<robo.depth});
          const n=s.lasersInimigo.getLength();
          tentarDispararLaser(s,(i+1)*720+100,robo);
          if(s.lasersInimigo.getLength()!==n)throw new Error('Cadência ignorada');
        }
        results.push({key,frame,shots});
        s.lasersInimigo.clear(true,true);robo.destroy();
      }
    }
    // Captura na escala real do jogo, ampliada uniformemente para ver os pixels.
    s.cameras.main.setZoom(2);
    s.cameras.main.setScroll(0,0);
    const draw = () => {
      for(let frame=0;frame<12;frame++) {
        const d=frame/3|0, c=frame%3;
        const x=400+c*200,y=320+d*120;
        const robo=s.add.sprite(x,y,'robo-teste',frame).setScale(.23).setDepth(12);
        Object.assign(robo,{direcaoAtual:dirs[d],ultimoLadoTiro:'left'});
        for(let gun=0;gun<2;gun++){
          const boca=obterBocaMetralhadora(robo);
          criarMunicaoRobo(s,boca.x,boca.y,angles[d],boca);
          // Uma segunda posição deixa visível o trajeto que emerge atrás dos ombros.
          if(d===3)criarMunicaoRobo(s,boca.x,boca.y-30,angles[d],boca);
        }
        s.add.text(x,y+49,dirs[d]+' / quadro '+frame,{fontSize:'9px',color:'#b7c6d6'}).setOrigin(.5,0).setDepth(60);
      }
    };
    draw();s.children.depthSort();
    return results;
  });
  for (const { frame, shots } of results) {
    assert.notDeepEqual(shots[0].boca, shots[1].boca, `duas armas distintas no quadro ${frame}`);
    assert.deepEqual(shots[0].boca, shots[2].boca, `alternância no quadro ${frame}`);
    for (const shot of shots) {
      assert.ok(Math.hypot(shot.rear.x-shot.boca.x,shot.rear.y-shot.boca.y)<.001, 'traseira da munição coincide com cano');
      assert.ok(Math.hypot(shot.center.x-shot.body.x,shot.center.y-shot.body.y)<.001, 'colisão centrada no projétil');
      assert.ok(Math.abs(shot.angle-shot.desired)<.001,'velocidade mira a partir do cano');
      assert.equal(shot.behind,frame>=9,'canos ocultos na vista traseira');
    }
  }
  await page.waitForTimeout(100);
  await page.locator('canvas').screenshot({ path: pasta + '/canos-e-projeteis.png' });
  assert.deepEqual(errors, []);
  console.log(`PASS: ${results.length} poses, três disparos alternados por pose, cadência, mira, colisão e captura visual.`);
} finally { await browser.close(); }
