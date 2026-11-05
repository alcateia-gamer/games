import assert from 'node:assert/strict';
import test from 'node:test';
import { criarTentaculos } from './Tentaculos.js';

function preparar(config={},extras={}) {
  const avisos=[],capturas=[],liberacoes=[],danos=[],ativas=new Set();
  const encontro={x:0,y:0,config:{arena:{xMin:-500,xMax:500,yMin:-500,yMax:500}}};
  const scene={player:{x:450,y:450}};let semente=12345;
  const servicos={
    rng(){semente=(semente*1664525+1013904223)>>>0;return semente/2**32;},
    criarAviso(x,y,raio){const a={x,y,raio,destruicoes:0,atualizar(){},destruir(){this.destruicoes++;}};avisos.push(a);return a;},
    pontoLivre:()=>true,
    jogadorAtingeCirculo:(x,y,r)=>Math.hypot(x-scene.player.x,y-scene.player.y)<=r,
    capturarJogador(id,duracao,ponto,opcoes){if(ativas.size)return false;capturas.push({id,duracao,ponto,opcoes});ativas.add(id);return true;},
    capturaAtiva:id=>ativas.has(id),
    liberarJogador(id){liberacoes.push(id);ativas.delete(id);},
    danoJogador:(...args)=>danos.push(args),...extras,
  };
  const ataque=criarTentaculos(scene,encontro,config,servicos);
  const aproximar=(i=0)=>Object.assign(scene.player,ataque.snapshot().armadilhas[i]);
  return {ataque,scene,encontro,avisos,capturas,liberacoes,danos,ativas,aproximar};
}

test('sorteia cinco tentáculos entre 120 e 300px do boss, separados e fixos',()=>{
  for(let i=0;i<5;i++){
    const c=preparar({}, {rng:()=>i/5});const a=c.ataque.snapshot().armadilhas;
    assert.equal(a.length,5);
    for(let j=0;j<a.length;j++){
      assert.ok(Math.hypot(a[j].x,a[j].y)>=119.999&&Math.hypot(a[j].x,a[j].y)<=300.001);
      for(let k=0;k<j;k++)assert.ok(Math.hypot(a[j].x-a[k].x,a[j].y-a[k].y)>=48);
    }
    const pontos=a.map(({x,y})=>({x,y}));
    c.scene.player.x=-450;c.ataque.atualizar(500);
    assert.deepEqual(c.ataque.snapshot().armadilhas.map(({x,y})=>({x,y})),pontos);
  }
});

test('aviso não captura; no surgimento retira todos os avisos e pede oito apertos',()=>{
  const c=preparar();c.aproximar();c.ataque.atualizar(999);
  assert.equal(c.capturas.length,0);assert.ok(c.avisos.every(a=>a.destruicoes===0));
  c.ataque.atualizar(1);assert.equal(c.capturas.length,1);
  assert.equal(c.capturas[0].opcoes.apertos,8);
  assert.ok(c.avisos.every(a=>a.destruicoes===1));assert.deepEqual(c.danos,[]);
});

test('agarrão não termina pelo antigo prazo; aguarda a libertação e não recaptura pela mesma armadilha',()=>{
  const c=preparar();c.aproximar();c.ataque.atualizar(1000);
  assert.equal(c.ataque.duracao,Infinity);
  assert.equal(c.ataque.atualizar(60000),false);assert.equal(c.liberacoes.length,0);
  c.ativas.clear();assert.equal(c.ataque.atualizar(1),true);
  assert.deepEqual(c.liberacoes,[c.capturas[0].id]);assert.equal(c.capturas.length,1);
  c.ataque.destruir();assert.equal(c.liberacoes.length,1);
});

test('captura perto do fim da janela ainda exige libertação, sem dano extra',()=>{
  const c=preparar();c.ataque.atualizar(18900);assert.equal(c.capturas.length,0);
  c.aproximar();c.ataque.atualizar(50);assert.equal(c.capturas.length,1);
  assert.equal(c.ataque.atualizar(10000),false);assert.deepEqual(c.danos,[]);
  c.ativas.clear();assert.equal(c.ataque.atualizar(1),true);
});

test('modo temporal explícito continua disponível para cenas de teste',()=>{
  const c=preparar({apertosParaLibertar:0});c.aproximar();c.ataque.atualizar(1000);
  c.ataque.atualizar(2499);assert.equal(c.liberacoes.length,0);
  c.ataque.atualizar(1);assert.equal(c.liberacoes.length,1);
});

test('cancelar libera só a captura própria, limpa avisos e é idempotente',()=>{
  const c=preparar();c.aproximar();c.ataque.atualizar(1000);c.ataque.destruir();c.ataque.destruir();
  assert.deepEqual(c.liberacoes,[c.capturas[0].id]);
  assert.ok(c.avisos.every(a=>a.destruicoes===1));
  c.ataque.atualizar(10000);assert.equal(c.capturas.length,1);
});

test('IDs são distintos entre execuções e cancelar no aviso não libera capturas alheias',()=>{
  const a=preparar(),b=preparar();a.aproximar();b.aproximar();
  a.ataque.atualizar(1000);b.ataque.atualizar(1000);
  assert.notEqual(a.capturas[0].id,b.capturas[0].id);
  const c=preparar();c.ataque.destruir();assert.deepEqual(c.liberacoes,[]);
});

test('mapa bloqueado não cria armadilhas nem sorteio infinito ou captura retroativa',()=>{
  const c=preparar({}, {pontoLivre:()=>false});assert.equal(c.ataque.snapshot().armadilhas.length,0);
  assert.equal(c.ataque.atualizar(30000),true);assert.deepEqual(c.capturas,[]);
  const d=preparar();d.aproximar();d.ataque.atualizar(30000);assert.deepEqual(d.capturas,[]);
});

test('captura recusada não consome a armadilha; alvo liberado pode ser capturado depois',()=>{
  let imune=true;
  const c=preparar({}, {capturarJogador:()=>!imune});c.aproximar();c.ataque.atualizar(1000);
  assert.equal(c.ataque.snapshot().armadilhas[0].capturou,false);
  imune=false;c.ataque.atualizar(10);
  assert.equal(c.ataque.snapshot().armadilhas[0].capturou,true);
});
