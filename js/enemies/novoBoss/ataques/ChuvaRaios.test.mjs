import assert from "node:assert/strict";
import test from "node:test";
import { criarChuvaRaios } from "./ChuvaRaios.js";
import { novoBossConfig } from "../NovoBossConfig.js";
import { assetsNovoBoss } from "../NovoBossAssets.js";

function preparar({ textura = true, pontoLivre = () => true, quantidade = 1, raioPlayer = 8,
  config = {}, rng = () => 0.5, configurarCena = () => {} } = {}) {
  const eventos = [];
  const avisos = [];
  const visuais = [];
  const scene = {
    player: { x: 0, y: 0 },
    textures: { exists: () => textura },
    add: {
      sprite(x, y, chave, frame) {
        const visual = { x, y, chave, frame, destruidos: 0,
          setOrigin(x, y) { this.origem = { x, y }; return this; },
          setScale(escala) { this.escala = escala; return this; },
          setDepth(depth) { this.depth = depth; return this; },
          setFrame(valor) { this.frame = valor; return this; },
          destroy() { this.destruidos++; },
        };
        visuais.push(visual);
        return visual;
      },
      graphics() {
        const visual = { destruidos: 0, circulos: [],
          setDepth(depth) { this.depth = depth; return this; },
          clear() {}, fillStyle() {}, lineStyle() {},
          fillCircle(x, y, raio) { this.circulos.push({ x, y, raio }); },
          strokeCircle() {}, destroy() { this.destruidos++; },
        };
        visuais.push(visual);
        return visual;
      },
    },
  };
  const encontro = { x: 0, y: 0, config: { arena: {
    xMin: -500, xMax: 500, yMin: -400, yMax: 400, entradaY: 350,
  } } };
  const servicos = {
    rng,
    pontoLivre,
    criarAviso(x, y, raio, duracao) {
      eventos.push("aviso");
      const aviso = { x, y, raio, duracao, progresso: [], destruidos: 0,
        atualizar(valor) { this.progresso.push(valor); },
        destruir() { this.destruidos++; },
      };
      avisos.push(aviso);
      return aviso;
    },
    jogadorAtingeCirculo: (x, y, raio) => Math.hypot(scene.player.x - x, scene.player.y - y) <= raio + raioPlayer,
    danoJogador(dano, origem) { eventos.push({ dano, origem }); return true; },
  };
  configurarCena(scene);
  const ataque = criarChuvaRaios(scene, encontro, { quantidade, ...config }, servicos);
  return { ataque, scene, encontro, servicos, eventos, avisos, visuais };
}

test("Heavens Fury anuncia antes da animação e só causa dano no frame quatro", () => {
  const { ataque, eventos, avisos, visuais } = preparar();
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].raio, 48);
  assert.equal(avisos[0].duracao, 1400);
  ataque.atualizar(999);
  assert.deepEqual(eventos, ["aviso"]);
  assert.equal(visuais.length, 0);
  ataque.atualizar(1);
  assert.equal(visuais[0].frame, 0);
  assert.equal(visuais[0].chave, "novo-boss-heavens-fury");
  assert.equal(visuais[0].escala, 0.6);
  assert.equal(visuais[0].depth, 52);
  assert.deepEqual(visuais[0].origem, { x: 0.5, y: 0.75 });
  ataque.atualizar(399);
  assert.equal(visuais[0].frame, 3);
  assert.equal(avisos[0].destruidos, 0);
  assert.equal(eventos.length, 1);
  ataque.atualizar(1);
  assert.equal(visuais[0].frame, 4);
  assert.equal(avisos[0].destruidos, 1);
  assert.deepEqual(eventos[1], { dano: 16, origem: { x: 0, y: 0 } });
  ataque.atualizar(149);
  assert.equal(eventos.length, 2, "mesmo impacto não aplica dano outra vez");
});

test("alvo fica fixo: sair antes do zero esquiva e entrar na cauda não recebe dano", () => {
  const { ataque, scene, eventos } = preparar();
  scene.player.x = 200;
  ataque.atualizar(1400);
  assert.equal(ataque.snapshot().marcas[0].x, 0);
  assert.deepEqual(eventos, ["aviso"]);
  scene.player.x = 0;
  ataque.atualizar(50);
  assert.equal(eventos.length, 1, "entrar depois do zero não cria um acerto atrasado");
});

test("perigo termina após o intervalo e não atinge quem entrar depois", () => {
  const { ataque, scene, eventos } = preparar();
  scene.player.x = 200;
  ataque.atualizar(1600);
  scene.player.x = 0;
  ataque.atualizar(1);
  assert.deepEqual(eventos, ["aviso"]);
});

test("chuva distribui cinco marcas livres e espaçadas mesmo com RNG constante", () => {
  const { ataque, encontro, avisos } = preparar({ quantidade: 5,
    pontoLivre: (x, y) => x <= 200 && y <= 300,
  });
  const marcas = ataque.snapshot().marcas;
  assert.equal(marcas.length, 5);
  assert.equal(avisos.length, 1);
  for (let i = 0; i < marcas.length; i++) {
    const marca = marcas[i];
    assert.equal(marca.inicio, i * 260);
    assert.ok(marca.x - 48 >= encontro.config.arena.xMin);
    assert.ok(marca.y + 48 <= encontro.config.arena.entradaY);
    assert.ok(marca.x <= 200 && marca.y <= 300);
    for (let j = 0; j < i; j++) assert.ok(Math.hypot(marca.x - marcas[j].x, marca.y - marcas[j].y) >= 120);
  }
  ataque.atualizar(259);
  assert.equal(avisos.length, 1);
  ataque.atualizar(1);
  assert.equal(avisos.length, 2);
});

test("nenhum alvo é criado sobre obstáculos quando toda a arena está bloqueada", () => {
  const { ataque, avisos, eventos } = preparar({ quantidade: 5, pontoLivre: () => false });
  assert.deepEqual(ataque.snapshot().marcas, []);
  assert.equal(ataque.atualizar(16), true);
  assert.deepEqual(avisos, []);
  assert.deepEqual(eventos, []);
});

test("falta de textura usa impacto temporário alinhado ao raio do aviso", () => {
  const { ataque, visuais, eventos } = preparar({ textura: false });
  ataque.atualizar(1400);
  assert.deepEqual(visuais[0].circulos, [{ x: 0, y: 0, raio: 48 }]);
  assert.equal(visuais[0].depth, 52);
  assert.equal(eventos.length, 2);
});

test("delta longo cruza o impacto sem perder o dano nem repetir limpeza", () => {
  const { ataque, avisos, visuais, eventos } = preparar();
  assert.equal(ataque.atualizar(10000), true);
  assert.equal(eventos.length, 2);
  assert.equal(avisos[0].destruidos, 1);
  assert.equal(visuais[0].destruidos, 1);
  assert.equal(ataque.atualizar(10000), true);
  ataque.destruir();
  assert.equal(eventos.length, 2);
  assert.equal(avisos[0].destruidos, 1);
  assert.equal(visuais[0].destruidos, 1);
});

test("cancelamento durante o aviso ou efeito limpa somente seus recursos", () => {
  for (const tempo of [0, 1100, 1410]) {
    const { ataque, avisos, visuais } = preparar();
    ataque.atualizar(tempo);
    ataque.destruir();
    ataque.destruir();
    assert.equal(ataque.atualizar(10000), true);
    assert.ok(avisos.every((aviso) => aviso.destruidos === 1));
    assert.ok(visuais.every((visual) => visual.destruidos === 1));
  }
});

test("deltas inválidos não antecipam o aviso ou impacto", () => {
  const { ataque, eventos } = preparar();
  for (const delta of [NaN, Infinity, -500, undefined]) ataque.atualizar(delta);
  assert.equal(ataque.snapshot().tempo, 0);
  assert.deepEqual(eventos, ["aviso"]);
});

test("chuva de produção tem quinze impactos de raio 96, com animação dimensionada ao diâmetro 192", () => {
  const c = preparar({ config: novoBossConfig.ataques.chuvaRaios });
  const s = c.ataque.snapshot();
  assert.equal(s.marcas.length, 15);
  assert.equal(s.raio, 96);
  assert.equal(s.duracao, 7900);
  assert.equal(c.avisos[0].raio, 96);
  assert.equal(c.avisos[0].duracao, 1400);
  c.ataque.atualizar(1000);
  assert.equal(c.visuais[0].escala, 1.28);
  assert.equal(c.visuais[0].escala * assetsNovoBoss.heavensFury.diametroImpacto, 192);
  assert.deepEqual(c.visuais[0].origem, { x: 198 / 384, y: 0.75 });
  assert.equal(c.visuais[0].frame, 0);
});

test("reutilização temporal entrega quinze alvos com RNG constante sem sobrepor avisos e perigos", () => {
  const c = preparar({ config: { ...novoBossConfig.ataques.chuvaRaios, mirarJogador: false } });
  const marcas = c.ataque.snapshot().marcas;
  let reutilizou = false;
  for (let i = 0; i < marcas.length; i++) {
    assert.equal(marcas[i].inicio, i * 400);
    assert.ok(marcas[i].x - 96 >= c.encontro.config.arena.xMin);
    assert.ok(marcas[i].y + 96 <= c.encontro.config.arena.entradaY);
    for (let j = 0; j < i; j++) {
      const distancia = Math.hypot(marcas[i].x - marcas[j].x, marcas[i].y - marcas[j].y);
      const intervalo = marcas[i].inicio - marcas[j].inicio;
      if (intervalo < 1550) assert.ok(distancia >= 216);
      if (distancia === 0) {
        assert.ok(intervalo >= 1550);
        reutilizou = true;
      }
    }
  }
  assert.ok(reutilizou, "Voltar a regiões encerradas permite mais raios sem preencher toda a arena.");
  c.ataque.atualizar(1599);
  assert.equal(c.avisos.length, 4);
  c.ataque.atualizar(1);
  assert.equal(c.avisos.length, 5);
  assert.equal(c.avisos[4].duracao, 1400);
  assert.equal(c.avisos[4].progresso.at(-1), 0, "Região reutilizada recebe aviso completo.");
});

test("raio maior realmente atinge além de 48 px e continua sem dano antes do quadro quatro", () => {
  const c = preparar({ config: { ...novoBossConfig.ataques.chuvaRaios, quantidade: 1 }, raioPlayer: 0 });
  c.scene.player.x = 90;
  c.ataque.atualizar(1399);
  assert.equal(c.eventos.length, 1);
  c.ataque.atualizar(1);
  assert.deepEqual(c.eventos[1], { dano: 40, origem: { x: 0, y: 0 } });
  c.ataque.atualizar(150);
  assert.equal(c.eventos.length, 2);
  const fora = preparar({ config: { ...novoBossConfig.ataques.chuvaRaios, quantidade: 1 }, raioPlayer: 0 });
  fora.scene.player.x = 97;
  fora.ataque.atualizar(1400);
  assert.equal(fora.eventos.length, 1);
});

test("sequência ampliada conserva quinze impactos e limpeza com deltas grandes e pequenos", () => {
  const a = preparar({ config: novoBossConfig.ataques.chuvaRaios });
  const b = preparar({ config: novoBossConfig.ataques.chuvaRaios });
  for (const c of [a, b]) c.servicos.jogadorAtingeCirculo = () => true;
  assert.equal(a.ataque.atualizar(7900), true);
  for (let i = 0; i < 395; i++) b.ataque.atualizar(20);
  for (const c of [a, b]) {
    assert.equal(c.eventos.filter(e => e.dano === 40).length, 15);
    assert.equal(c.avisos.length, 15);
    assert.equal(c.visuais.length, 15);
    assert.ok(c.avisos.every(o => o.destruidos === 1));
    assert.ok(c.visuais.every(o => o.destruidos === 1));
    assert.ok(c.ataque.snapshot().marcas.every(m => m.concluida));
  }
  assert.deepEqual(a.ataque.snapshot().marcas, b.ataque.snapshot().marcas);
});

test("cancelar a chuva ampliada não deixa avisos nem cria os raios restantes", () => {
  for (const tempo of [500, 1800, 5700]) {
    const c = preparar({ config: novoBossConfig.ataques.chuvaRaios });
    c.ataque.atualizar(tempo);
    c.ataque.destruir();
    c.ataque.destruir();
    const criados = c.visuais.length, danos = c.eventos.filter(e => e.dano).length;
    c.ataque.atualizar(9000);
    assert.equal(c.visuais.length, criados);
    assert.equal(c.eventos.filter(e => e.dano).length, danos);
    assert.ok(c.avisos.every(o => o.destruidos === 1));
    assert.ok(c.visuais.every(o => o.destruidos === 1));
  }
});

test("busca fina encontra áreas válidas que uma grade do tamanho dos círculos perderia", () => {
  const centros = [[-300, -200], [0, -200], [300, -200], [0, 150]];
  const c = preparar({ config: { ...novoBossConfig.ataques.chuvaRaios, mirarJogador: false },
    pontoLivre: (x, y) => centros.some(([cx, cy]) => Math.hypot(cx - x, cy - y) <= 20),
  });
  const marcas = c.ataque.snapshot().marcas;
  assert.equal(marcas.length, 15);
  assert.ok(marcas.every(m => centros.some(([x, y]) => Math.hypot(x - m.x, y - m.y) <= 20)));
});

test("cada aviso mira a posição atual; futuros alvos ficam pendentes e os anunciados não seguem o jogador", () => {
  const c = preparar({ config: novoBossConfig.ataques.chuvaRaios });
  assert.equal(c.ataque.snapshot().marcas.length, 15);
  assert.deepEqual(c.ataque.obterAlvoChuva(0), { x: 0, y: 0 });
  assert.equal(c.ataque.obterAlvoChuva(1), null);
  assert.equal(c.ataque.snapshot().marcas[1].x, null);
  c.scene.player.x = 200; c.scene.player.y = 50;
  c.ataque.atualizar(399);
  assert.equal(c.avisos.length, 1);
  c.ataque.atualizar(1);
  assert.deepEqual(c.ataque.obterAlvoChuva(1), { x: 200, y: 50 });
  c.scene.player.x = -200; c.scene.player.y = 100;
  c.ataque.atualizar(400);
  assert.deepEqual(c.ataque.obterAlvoChuva(2), { x: -200, y: 100 });
  assert.deepEqual(c.ataque.obterAlvoChuva(0), { x: 0, y: 0 });
  assert.deepEqual(c.ataque.obterAlvoChuva(1), { x: 200, y: 50 });
});

test("mira prioriza o centro da hitbox de dano e usa o corpo como alternativa", () => {
  const c = preparar({ config: novoBossConfig.ataques.chuvaRaios });
  c.scene.hitboxDanoPlayer = { x: 100, y: 50, width: 40, height: 30 };
  c.scene.player.body = { x: -100, y: -80, width: 30, height: 40 };
  c.ataque.atualizar(400);
  assert.deepEqual(c.ataque.obterAlvoChuva(1), { x: 120, y: 65 });
  delete c.scene.hitboxDanoPlayer;
  c.ataque.atualizar(400);
  assert.deepEqual(c.ataque.obterAlvoChuva(2), { x: -85, y: -60 });
});

test("mira junto a obstáculo escolhe a região livre próxima ao jogador sem consumir RNG", () => {
  const c = preparar({ config: novoBossConfig.ataques.chuvaRaios,
    pontoLivre: (x, y) => x >= 120 && y >= 40,
    rng: () => { throw new Error("Mira não precisa de sorteio."); } });
  const alvo = c.ataque.obterAlvoChuva(0);
  assert.ok(alvo.x >= 120 && alvo.y >= 40);
  assert.ok(Math.hypot(alvo.x - 120, alvo.y - 40) < 46);
  c.ataque.atualizar(400);
  assert.deepEqual(c.ataque.obterAlvoChuva(1), alvo);
});

test("mira nas bordas mantém todo o círculo dentro da arena e da entrada", () => {
  const c = preparar({ config: novoBossConfig.ataques.chuvaRaios });
  Object.assign(c.scene.player, { x: -1000, y: 1000 });
  c.ataque.atualizar(400);
  const alvo = c.ataque.obterAlvoChuva(1);
  assert.deepEqual(alvo, { x: -396, y: 246 });
  assert.ok(alvo.x - 96 >= c.encontro.config.arena.xMin);
  assert.ok(alvo.y + 96 < c.encontro.config.arena.entradaY);
});

test("alvo bloqueado não cria raio invisível e o aviso seguinte volta a funcionar", () => {
  let bloqueado = true;
  const c = preparar({ config: novoBossConfig.ataques.chuvaRaios, pontoLivre: () => !bloqueado });
  assert.equal(c.avisos.length, 0);
  assert.equal(c.ataque.obterAlvoChuva(0), null);
  assert.equal(c.ataque.snapshot().marcas[0].concluida, true);
  bloqueado = false;
  c.ataque.atualizar(400);
  assert.equal(c.avisos.length, 1);
  assert.equal(c.avisos[0].duracao, 1400);
  c.ataque.atualizar(1399);
  assert.equal(c.eventos.filter(e => e.dano).length, 0);
  c.ataque.atualizar(1);
  assert.equal(c.eventos.filter(e => e.dano).length, 1);
});

test("avisos mirados podem ocupar o mesmo alvo, com impactos espaçados e sem dano antecipado", () => {
  const c = preparar({ config: novoBossConfig.ataques.chuvaRaios });
  c.ataque.atualizar(1200);
  assert.equal(c.avisos.length, 4);
  assert.ok(c.avisos.every(a => a.x === 0 && a.y === 0 && a.raio === 96));
  assert.equal(c.eventos.filter(e => e.dano).length, 0);
  c.ataque.atualizar(200);
  assert.equal(c.eventos.filter(e => e.dano).length, 1);
  c.ataque.atualizar(150);
  assert.equal(c.eventos.filter(e => e.dano).length, 1);
  c.ataque.atualizar(250);
  assert.equal(c.eventos.filter(e => e.dano).length, 2);
});

test("sair dos alvos anunciados evita seus impactos e a nova mira pune ficar parado", () => {
  const c = preparar({ config: { ...novoBossConfig.ataques.chuvaRaios, quantidade: 3 } });
  c.scene.player.x = 200;
  c.ataque.atualizar(400);
  c.scene.player.x = -200;
  c.ataque.atualizar(400);
  c.ataque.atualizar(1000);
  assert.equal(c.eventos.filter(e => e.dano).length, 0);
  c.ataque.atualizar(400);
  assert.equal(c.eventos.filter(e => e.dano).length, 1);
});

test("cancelar conserva os registros anunciados e impede selecionar ou emitir alvos futuros", () => {
  const c = preparar({ config: novoBossConfig.ataques.chuvaRaios });
  c.ataque.atualizar(400);
  const alvo = c.ataque.obterAlvoChuva(1);
  alvo.x = 999;
  assert.equal(c.ataque.obterAlvoChuva(1).x, 0);
  c.ataque.destruir();
  c.scene.player.x = 200;
  c.ataque.atualizar(9000);
  assert.equal(c.ataque.obterAlvoChuva(2), null);
  assert.equal(c.avisos.length, 2);
  assert.ok(c.avisos.every(a => a.destruidos === 1));
});

test("chuva permite esquivar até 1ms antes do impacto; sair na animação não cancela dano", () => {
  const antes=preparar();
  antes.ataque.atualizar(1399);
  antes.scene.player.x=200;
  antes.ataque.atualizar(1);
  assert.equal(antes.eventos.length,1);
  assert.equal(antes.ataque.snapshot().marcas[0].impactoAvaliado,true);
  const depois=preparar();
  depois.ataque.atualizar(1400);
  assert.equal(depois.eventos.length,2);
  depois.scene.player.x=200;
  depois.ataque.atualizar(50);
  assert.equal(depois.eventos.length,2);
  assert.equal(depois.ataque.snapshot().marcas[0].atingiu,true);
});

test("chuva não repete impacto recusado pela invulnerabilidade depois do zero", () => {
  const c=preparar();let tentativas=0;
  c.servicos.danoJogador=()=>{tentativas++;return false;};
  c.ataque.atualizar(1400);
  assert.equal(tentativas,1);
  c.ataque.atualizar(50);
  assert.equal(tentativas,1);
  assert.equal(c.ataque.snapshot().marcas[0].atingiu,false);
});

for (const coop of [false,true]) test(`mira do boss ${coop?'coop':'solo'} troca da Aria para seu clone mesmo após o aviso`,()=>{
  let contexto;
  const c=preparar({config:novoBossConfig.ataques.chuvaRaios, configurarCena(scene) {
    scene.time={now:0};
    contexto=coop ? {player:{x:0,y:0},estadoEspecial:{}} : scene;
    contexto.estadoEspecial={};
    if(coop)scene.coopRuntime={bossTarget:()=>contexto};
  }});
  assert.deepEqual(c.ataque.obterAlvoChuva(0),{x:0,y:0});
  const clone={active:true,x:200,y:50,expiraEm:4500};
  contexto.estadoEspecial.holograma=clone;
  c.ataque.atualizar(100);
  assert.deepEqual(c.ataque.obterAlvoChuva(0),{x:200,y:50},'aviso já lançado é redirecionado');
  clone.x=250;clone.y=80;
  if(coop)c.scene.coopRuntime.bossTarget=()=>({player:{x:-200,y:-100}});
  c.ataque.atualizar(100);
  assert.deepEqual(c.ataque.obterAlvoChuva(0),{x:250,y:80},'mantém a Aria originalmente perseguida');
  clone.active=false;
  c.ataque.atualizar(100);
  assert.deepEqual(c.ataque.obterAlvoChuva(0),{x:250,y:80},'não volta a perseguir Aria com ataque já desviado');
});

test('novos avisos miram clone ativo e deixam de usar a hitbox da Aria',()=>{
  const c=preparar({config:novoBossConfig.ataques.chuvaRaios});
  c.scene.hitboxDanoPlayer={x:0,y:0,width:20,height:20};
  c.scene.estadoEspecial={holograma:{active:true,x:180,y:40}};
  c.ataque.atualizar(400);
  assert.deepEqual(c.ataque.obterAlvoChuva(1),{x:180,y:40});
  c.scene.estadoEspecial.holograma.active=false;
  c.ataque.atualizar(400);
  assert.deepEqual(c.ataque.obterAlvoChuva(2),{x:10,y:10});
});

test('som acompanha cada impacto da chuva uma vez, inclusive em frames atrasados',()=>{
  const c=preparar({config:{...novoBossConfig.ataques.chuvaRaios,quantidade:3}});
  const sons=[];
  c.servicos.somImpactoChuva=(ponto,atraso)=>sons.push({ponto,atraso});
  const primeiro=c.ataque.snapshot().marcas[0].impactoEm;
  c.ataque.atualizar(primeiro-1);
  assert.equal(sons.length,0,'aviso e queda ainda não tocam explosão');
  c.ataque.atualizar(1);
  assert.equal(sons.length,1);
  assert.equal(sons[0].atraso,0);
  for(let i=0;i<5;i++)c.ataque.atualizar(0);
  assert.equal(sons.length,1,'não repete nos frames da cauda da explosão');
  c.ataque.atualizar(850);
  assert.equal(sons.length,3);
  assert.deepEqual(sons.map(s=>s.atraso),[0,450,50]);
  for(let i=0;i<5;i++)c.ataque.atualizar(0);
  assert.equal(sons.length,3);
  c.ataque.destruir();
});
