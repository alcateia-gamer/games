import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import FlashlightWalls, { distanciaAresta } from "./FlashlightWalls.js";

function cena(objects = [], layers = []) {
  return { map: { layers, getObjectLayer: name => name === "collision"
    ? { objects: objects.map(objeto => ({ type: "parede", ...objeto })) } : null }, portasFabrica: [] };
}
function visivel(pontos, x, y) {
  if (!pontos.length) return true;
  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const a = pontos[i], b = pontos[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x-a.x) * (y-a.y) / (b.y-a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

test("paredes interrompem a luz nas quatro direções e nas diagonais, inclusive o halo atrás", () => {
  const walls = new FlashlightWalls(cena([
    { x: 60, y: -80, width: 4, height: 160 }, { x: -64, y: -80, width: 4, height: 160 },
    { x: -80, y: -64, width: 160, height: 4 }, { x: -80, y: 60, width: 160, height: 4 },
  ]));
  const p = walls.obterPoligono(0, 0);
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
    assert.equal(visivel(p, dx*40, dy*40), true);
    assert.equal(visivel(p, dx*90, dy*90), false);
  }
});

test("a luz contorna a quina e atravessa uma abertura sem vazar pelas paredes ao lado", () => {
  const corner = new FlashlightWalls(cena([{ x: 60, y: -50, width: 5, height: 100 }]));
  const p = corner.obterPoligono(0, 0);
  assert.equal(visivel(p, 62, 0), true, "a face da parede recebe o feixe");
  assert.equal(visivel(p, 100, 0), false);
  assert.equal(visivel(p, 100, 100), true);
  const gap = new FlashlightWalls(cena([
    { x: 60, y: -100, width: 4, height: 98 }, { x: 60, y: 2, width: 4, height: 98 },
  ])).obterPoligono(0, 0);
  assert.equal(visivel(gap, 180, 0), true);
  assert.equal(visivel(gap, 180, 10), false);
  const thin = new FlashlightWalls(cena([{ x: 60, y: 3, width: 0.1, height: 0.1 }])).obterPoligono(0, 0);
  assert.equal(visivel(thin, 120, 6.05), false, "raios nos vértices capturam obstáculos entre raios regulares");
});

test("polígonos e retângulos rotacionados usam a geometria original, incluindo coordenadas negativas", () => {
  const walls = new FlashlightWalls(cena([{ x: -150, y: -230, rotation: 0,
    polygon: [{x:0,y:0},{x:60,y:60},{x:60,y:90},{x:0,y:30}] }]));
  const p = walls.obterPoligono(-170, -200);
  assert.equal(visivel(p, -100, -200), false);
  assert.equal(visivel(p, -170, -140), true);
  const rotated = new FlashlightWalls(cena([{ x: 60, y: -20, width: 40, height: 4, rotation: 90 }]));
  assert.equal(visivel(rotated.obterPoligono(0, 0), 100, 0), false);
  assert.equal(distanciaAresta(0,0,1,0,{ax:60,ay:-20,bx:60,by:20}), 60);
});

test("paredes de tiles usam coordenadas do mundo e só as camadas de paredes bloqueiam", () => {
  function layer(name, indices) {
    return { name, tilemapLayer: { scaleX: 1, scaleY: 1,
      forEachTile(callback) { indices.forEach((index, x) => callback({ index, x, y: 0, width: 48, height: 48 })); },
      tileToWorldXY: (x, y) => ({ x: -192 + x*48, y: -96 + y*48 }),
    } };
  }
  const walls = new FlashlightWalls(cena([], [layer("chão", [1,1]), layer("ParedeAcimaPerso", [1,1,-1])]));
  const p = walls.obterPoligono(-220, -72);
  assert.equal(visivel(p, -200, -72), true);
  assert.equal(visivel(p, -80, -72), false);
  assert.equal(walls.proximas.length, 6, "a aresta interna de tiles vizinhos é removida");
  const floor = new FlashlightWalls(cena([], [layer("chão", [1,1])]));
  assert.equal(floor.obterPoligono(-220, -72).length, 0);
  for (const name of ["BordaAlta", "BordaCurvas", "Borda", "CurvaBorda"]) {
    const border = new FlashlightWalls(cena([], [layer(name, [1,1])]));
    assert.equal(border.obterPoligono(-220,-72).length, 0, `${name} fica fora do bloqueio`);
  }
});

test("colisões de objetos deixam a luz atingir os móveis sem atravessar a parede atrás", () => {
  const walls = new FlashlightWalls(cena([
    { type: "", x: 40, y: -30, width: 40, height: 60 },
    { type: "maquina", x: 90, y: -30,
      polygon: [{x:0,y:0},{x:30,y:0},{x:30,y:60},{x:0,y:60}] },
    { x: 150, y: -80, width: 5, height: 160 },
  ]));
  const p = walls.obterPoligono(0,0);
  assert.equal(visivel(p, 60,0), true, "o móvel recebe o feixe sobre sua própria colisão");
  assert.equal(visivel(p, 100,0), true, "a máquina também permanece iluminada");
  assert.equal(visivel(p, 180,0), false, "a parede continua bloqueando os objetos do outro lado");
});

test("bordas ficam fora do bloqueio enquanto a parede vizinha continua opaca", () => {
  function layer(name, tiles) {
    return { name, tilemapLayer: {
      forEachTile(callback) { tiles.forEach(([x,y]) => callback({index:1,x,y,width:48,height:48})); },
      tileToWorldXY: (x,y) => ({x:x*48, y:y*48}),
    } };
  }
  const walls = new FlashlightWalls(cena([], [layer("BordaAlta", [[0,-1]]), layer("ParedeAbaixoPerso", [[1,-1]])]));
  const p = walls.obterPoligono(24,120);
  assert.equal(visivel(p, 24,-40), true, "a borda não fecha a passagem");
  assert.equal(visivel(p, 84,-60), false, "a parede ao lado permanece opaca");
});

test("paredes sobrepostas e polígonos em qualquer ordem recebem luz sem revelar o espaço atrás", () => {
  const walls = new FlashlightWalls(cena([
    {x:50,y:-60,width:30,height:120}, {x:70,y:-60,width:30,height:120},
    {x:150,y:-60,width:20,height:120},
  ]));
  const p = walls.obterPoligono(0,0);
  assert.equal(visivel(p,60,0),true);
  assert.equal(visivel(p,90,0),true,"a superfície sobreposta também recebe luz");
  assert.equal(visivel(p,110,0),false);
  assert.equal(visivel(p,160,0),false,"a segunda parede não é iluminada através da primeira");
  const reverse = new FlashlightWalls(cena([{x:50,y:-60,
    polygon:[{x:0,y:0},{x:0,y:120},{x:30,y:120},{x:30,y:0}]}])).obterPoligono(0,0);
  assert.equal(visivel(reverse,60,0),true);
  assert.equal(visivel(reverse,90,0),false);
  const inside = walls.obterPoligono(60,0);
  assert.equal(visivel(inside,65,0),true);
  assert.equal(visivel(inside,110,0),false,"encostar na parede não libera luz no outro lado");
});

test("porta fechada bloqueia; abrir, desativar ou mover a porta atualiza a luz mesmo parado", () => {
  const scene = cena();
  const walls = new FlashlightWalls(scene);
  const porta = { colisao: { body: { x: 50, y: -25, width: 4, height: 50, enable: true } } };
  scene.portasFabrica.push(porta);
  walls.atualizarPortas();
  assert.equal(visivel(walls.obterPoligono(0,0), 100,0), false);
  const revision = walls.revisao;
  walls.atualizarPortas();
  assert.equal(walls.revisao, revision);
  porta.colisao.body.y += 100;
  walls.atualizarPortas();
  assert.equal(visivel(walls.obterPoligono(0,0), 100,0), true);
  porta.colisao.body.y -= 100;
  walls.atualizarPortas();
  assert.equal(visivel(walls.obterPoligono(0,0), 100,0), false);
  porta.colisao.body.enable = false;
  walls.atualizarPortas();
  assert.equal(visivel(walls.obterPoligono(0,0), 100,0), true);
  porta.colisao.body.enable = true;
  walls.atualizarPortas();
  porta.colisao = null;
  walls.atualizarPortas();
  assert.equal(visivel(walls.obterPoligono(0,0), 100,0), true);
});

test("o índice filtra obstáculos distantes, reutiliza o polígono parado e limpa referências", () => {
  const walls = new FlashlightWalls(cena([{ x: 60, y: -50, width: 4, height: 100 },
    ...Array.from({length:100}, (_,i) => ({x:10000+i*100,y:10000,width:10,height:10}))]));
  const p = walls.obterPoligono(0,0);
  assert.equal(walls.proximas.length, 4);
  const consultas = walls.consulta;
  assert.equal(walls.obterPoligono(0,0), p);
  assert.equal(walls.consulta, consultas);
  walls.obterPoligono(1,0);
  assert.equal(walls.consulta, consultas+1);
  walls.destroy();
  assert.equal(walls.indice.size, 0);
  assert.equal(walls.scene, null);
});

test("a parede fina real da fábrica bloqueia o corredor sem alterar o mapa", () => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const objects = raw.layers.find(l => l.name === "collision").objects;
  const layers = raw.layers.filter(l => l.type === "tilelayer").map(layer => ({
    name: layer.name, tilemapLayer: {
      tileToWorldXY: (x,y) => ({x:x*48, y:y*48}),
      forEachTile(callback) {
        for (const chunk of layer.chunks) {
          const buffer = Buffer.from(chunk.data, "base64");
          for (let i = 0; i < chunk.width * chunk.height; i++) {
            const gid = buffer.readUInt32LE(i*4);
            if (gid) callback({ index: gid, x: chunk.x + i%chunk.width,
              y: chunk.y + Math.floor(i/chunk.width), width: 48, height: 48 });
          }
        }
      },
    },
  }));
  // Os tipos originais vazios continuam vazios: móveis reais não viram paredes.
  const walls = new FlashlightWalls(cena(objects, layers));
  const p = walls.obterPoligono(-840,-5110);
  assert.equal(visivel(p, -840,-5160), true);
  assert.equal(visivel(p, -840,-5230), true, "a face da parede real recebe luz");
  assert.equal(visivel(p, -840,-5310), false, "o espaço atrás da parede continua escuro");
  const border = walls.obterPoligono(-1000,-5290);
  assert.equal(visivel(border, -840,-5290), true, "a faixa de BordaAlta não bloqueia a luz");
  const object = walls.obterPoligono(-1370,-4940);
  assert.equal(visivel(object, -1250,-4940), true, "a estrutura de produção real recebe luz");
});
