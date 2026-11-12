import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import FlashlightWalls, { distanciaAresta } from "./FlashlightWalls.js";
import { criarColisoesFabrica } from "../map/ColisoesMapa.js";

function cena(objects = [], layers = [], limites = []) {
  return { map: { layers, getObjectLayer: name => name === "collision"
    ? { objects } : name === "LimitaLuz" ? { objects: limites } : null }, portasFabrica: [] };
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
  assert.equal(visivel(p, -200, -72), true, "o espaço antes da parede recebe luz");
  assert.equal(visivel(p, -180, -72), true, "a oclusão visual da camada é aplicada no carimbo da lanterna");
  assert.equal(visivel(p, -80, -72), false);
  assert.equal(walls.proximas.length, 6, "a aresta interna de tiles vizinhos é removida");
  const abaixo = new FlashlightWalls(cena([], [layer("ParedeAbaixoPerso", [1,1])]));
  assert.equal(visivel(abaixo.obterPoligono(-220, -72), -180, -72), true,
    "ParedeAbaixoPerso continua recebendo luz na superfície");
  const floor = new FlashlightWalls(cena([], [layer("chão", [1,1])]));
  assert.equal(floor.obterPoligono(-220, -72).length, 0);
  for (const name of ["BordaAlta", "BordaCurvas", "Borda", "CurvaBorda"]) {
    const border = new FlashlightWalls(cena([], [layer(name, [1,1])]));
    assert.equal(border.obterPoligono(-220,-72).length, 0, `${name} fica fora do bloqueio`);
  }
});

test("a sobreposição visual de ParedeAcimaPerso conserva os contornos que bloqueiam o espaço atrás", () => {
  const layer = { name: "ParedeAcimaPerso", tilemapLayer: {
    forEachTile(callback) { callback({ index: 1, x: 0, y: 0, width: 48, height: 48 }); },
    tileToWorldXY: () => ({ x: 0, y: 0 }),
  } };
  const walls = new FlashlightWalls(cena([{ x: -4, y: -4, width: 56, height: 56 }], [layer]));
  for (const [x, y] of [[-50,24], [100,24], [24,-50], [24,100], [-50,-50], [100,100]]) {
    const p = walls.obterPoligono(x, y);
    assert.equal(visivel(p, 24, 24), true, "o contorno permite compor a silhueta real do tile depois");
    assert.equal(visivel(p, 48 - x, 48 - y), false, `a parede bloqueia o espaço atrás visto de ${x},${y}`);
    assert.equal(visivel(p, (x+24)/2, (y+24)/2), true, "o cenário antes da parede recebe luz");
  }
});

test("colisões sem tipo iluminam o móvel atingido e bloqueiam a luz atrás dele", () => {
  const walls = new FlashlightWalls(cena([
    { type: "", x: 40, y: -30, width: 40, height: 60 },
    { type: "maquina", x: 90, y: -30,
      polygon: [{x:0,y:0},{x:30,y:0},{x:30,y:60},{x:0,y:60}] },
    { x: 150, y: -80, width: 5, height: 160 },
  ]));
  const p = walls.obterPoligono(0,0);
  assert.equal(visivel(p, 60,0), true, "o móvel recebe o feixe sobre sua própria colisão");
  assert.equal(visivel(p, 85,0), false, "a luz termina na colisão do primeiro móvel");
  assert.equal(visivel(p, 100,0), false, "a máquina atrás do móvel fica na sombra");
  assert.equal(visivel(p, 180,0), false, "a parede continua bloqueando os objetos do outro lado");
  const maquina = walls.obterPoligono(85,0);
  assert.equal(visivel(maquina, 100,0), true, "a máquina recebe luz quando atingida diretamente");
  assert.equal(visivel(maquina, 130,0), false, "o tipo maquina também bloqueia o feixe atrás");
});

test("pontos, textos e objetos sem área na camada collision não bloqueiam a lanterna", () => {
  const walls = new FlashlightWalls(cena([
    { x: 30, y: -20, width: 20, height: 40, point: true },
    { x: 60, y: -20, width: 20, height: 40, text: { text: "Anotação" } },
    { x: 90, y: -20, width: 0, height: 40 },
  ]));
  assert.equal(walls.obterPoligono(0, 0).length, 0);
});

test("Luzatravessa=true libera só a luz e a parede atrás continua bloqueando", () => {
  for (const properties of [
    [{ name: "Luzatravessa", type: "bool", value: true }],
    { Luzatravessa: true },
  ]) {
    const scene = cena([
      { x: 40, y: -30, width: 20, height: 60, properties },
      { x: 120, y: -30, polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 },
        { x: 10, y: 60 }, { x: 0, y: 60 }] },
    ]);
    const corpos = [];
    scene.physics = { add: { staticGroup: () => ({ create(x, y) {
      const corpo = { x, y, setSize(width, height) { Object.assign(this, { width, height }); },
        setVisible() {} };
      corpos.push(corpo);
      return corpo;
    } }) } };
    criarColisoesFabrica(scene, scene.map);
    assert.ok(corpos.some(corpo => corpo.x === 50 && corpo.y === 0 && corpo.width === 20 && corpo.height === 60),
      "o objeto marcado continua sólido para o jogador");
    const walls = new FlashlightWalls(scene);
    const p = walls.obterPoligono(0, 0);
    assert.equal(visivel(p, 90, 0), true, "a lanterna atravessa a colisão marcada");
    assert.equal(visivel(p, 150, 0), false, "a colisão não marcada atrás continua bloqueando");
  }
});

test("somente o booleano true em Luzatravessa permite atravessar retângulos e polígonos", () => {
  for (const valor of [undefined, false, "true", 1]) {
    for (const properties of [
      valor === undefined ? undefined : [{ name: "Luzatravessa", value: valor }],
      { Luzatravessa: valor },
    ]) {
      const p = new FlashlightWalls(cena([{ x: 40, y: -30, width: 20, height: 60, properties }]))
        .obterPoligono(0, 0);
      assert.equal(visivel(p, 90, 0), false, `valor ${valor} mantém o bloqueio`);
    }
  }
  const p = new FlashlightWalls(cena([{ x: 40, y: -30, properties: { Luzatravessa: true },
    polygon: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 60 }, { x: 0, y: 60 }] }]))
    .obterPoligono(0, 0);
  assert.equal(visivel(p, 90, 0), true, "a propriedade também libera polígonos");
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

function contextoRecorte() {
  return { pontos: [], beginPath() { this.pontos = []; },
    moveTo(x, y) { this.pontos.push({ x, y }); }, lineTo(x, y) { this.moveTo(x, y); },
    closePath() {}, clip() {} };
}

test("luz fixa na parede emite do suporte e continua bloqueado pela próxima colisão", () => {
  const walls = new FlashlightWalls(cena([
    { x: -10, y: -10, width: 20, height: 20 },
    { x: 60, y: -80, width: 4, height: 160 },
  ]));
  const context = contextoRecorte();
  assert.equal(visivel(walls.obterPoligono(0, 0), 40, 0), false, "a regra de origem da lanterna é preservada");
  walls.recortarFonte(context, { x: 0, y: 0 }, 240);
  assert.equal(visivel(context.pontos, 40, 0), true, "o luz fixa ilumina fora do próprio suporte");
  assert.equal(visivel(context.pontos, 100, 0), false, "não atravessa a próxima parede");
});

test("fontes fixas guardam polígonos independentes e recalculam ao abrir portas", () => {
  const scene = cena([{ x: 60, y: -80, width: 4, height: 160 }]);
  const walls = new FlashlightWalls(scene);
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
  const context = contextoRecorte();
  walls.recortarFonte(context, a, 240);
  assert.equal(visivel(context.pontos, 100, 0), false);
  walls.recortarFonte(context, b, 240);
  assert.equal(visivel(context.pontos, 0, 0), false);
  const consultas = walls.consulta;
  walls.recortarFonte(context, a, 240);
  assert.equal(walls.consulta, consultas, "o giro e a segunda passagem de cor reutilizam o recorte");
  assert.equal(visivel(context.pontos, 50, 0), true, "o cache da outra fonte não substitui o primeiro");
  scene.portasFabrica.push({ colisao: { body: { x: 20, y: -80, width: 4, height: 160, enable: true } } });
  walls.atualizarPortas();
  walls.recortarFonte(context, a, 240);
  assert.equal(visivel(context.pontos, 50, 0), false, "fechar a porta invalida o polígono");
  scene.portasFabrica[0].colisao.body.enable = false;
  walls.atualizarPortas();
  walls.recortarFonte(context, a, 240);
  assert.equal(visivel(context.pontos, 50, 0), true, "abrir a porta devolve a iluminação");
});

test("o bloqueio acompanha o alcance de um luz fixa maior que a lanterna", () => {
  const walls = new FlashlightWalls(cena([{ x: 450, y: -100, width: 4, height: 200 }]));
  const context = contextoRecorte();
  walls.recortarFonte(context, { x: 0, y: 0 }, 600);
  assert.equal(visivel(context.pontos, 400, 0), true);
  assert.equal(visivel(context.pontos, 500, 0), false);
});

test("LimitaLuz corta já na borda mesmo com Luzatravessa=true ou a exceção da sala ativa", () => {
  const scene = cena([{ x: 55, y: -80, width: 40, height: 160 }], [], [
    { x: 60, y: -80, width: 20, height: 160, properties: { Luzatravessa: true } },
  ]);
  const walls = new FlashlightWalls(scene);
  for (const regiao of [null, { left: 0, top: -100, right: 200, bottom: 100 }]) {
    const p = walls.obterPoligono(0, 0, regiao);
    assert.equal(visivel(p, 50, 0), true);
    assert.equal(visivel(p, 65, 0), false, "o interior da barreira não recebe luz");
    assert.equal(visivel(p, 100, 0), false, "a espessura de outras paredes não libera o limite");
  }
  const context = contextoRecorte();
  walls.recortarFonte(context, { x: 0, y: 0 }, 240);
  assert.equal(visivel(context.pontos, 65, 0), false, "luz fixa respeita o mesmo limite");
});

test("LimitaLuz aceita polígonos, linhas e retângulos rotacionados", () => {
  for (const limite of [
    { x: 60, y: -20, width: 40, height: 4, rotation: 90 },
    { x: 56, y: -20, polygon: [{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 40 }] },
    { x: 56, y: -20, polyline: [{ x: 0, y: 0 }, { x: 0, y: 40 }] },
  ]) {
    const walls = new FlashlightWalls(cena([], [], [limite]));
    const p = walls.obterPoligono(0, 0);
    assert.equal(visivel(p, 50, 0), true);
    assert.equal(visivel(p, 58, 0), false);
    assert.equal(visivel(p, 100, 0), false);
  }
});

test("lâmpadas podem usar só LimitaLuz sem ganhar bloqueios de colisão novos", () => {
  const scene = cena([{ x: 40, y: -80, width: 4, height: 160 }], [],
    [{ x: 100, y: -80, width: 4, height: 160 }]);
  const walls = new FlashlightWalls(scene, { somenteLimites: true });
  const p = walls.obterPoligono(0, 0);
  assert.equal(visivel(p, 60, 0), true, "o modo de limites preserva a iluminação prévia dos móveis");
  assert.equal(visivel(p, 110, 0), false);
});

test("a barreira real LimitaLuz bloqueia o corredor mesmo com a propriedade Luzatravessa ligada", () => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = raw.layers.find(l => l.name === "LimitaLuz");
  const antes = JSON.stringify(layer);
  const walls = new FlashlightWalls(cena([], [], layer.objects), { somenteLimites: true });
  const p = walls.obterPoligono(-1080, -5290);
  assert.equal(visivel(p, -1080, -5310), true);
  assert.equal(visivel(p, -1080, -5330), false);
  assert.equal(visivel(p, -1080, -5360), false);
  assert.equal(JSON.stringify(layer), antes);
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
  // Usa os tipos originais vazios para verificar as colisões reais exportadas pelo Tiled.
  const area = raw.layers.find(l => l.name === "trocadecamada").objects.find(o => o.name === "trocadecamada01");
  const regiao = { left: area.x, top: area.y, right: area.x + area.width, bottom: area.y + area.height };
  const scene = cena(objects, layers);
  scene.regiaoTrocaCamada = regiao;
  const walls = new FlashlightWalls(scene);
  const p = walls.obterPoligono(-840,-5110);
  assert.equal(visivel(p, -840,-5160), true);
  assert.equal(visivel(p, -840,-5230), true, "a face da parede real recebe luz");
  assert.equal(visivel(p, -840,-5310), false, "o espaço atrás da parede continua escuro");
  const permiteLuz = id => objects.find(objeto => objeto.id === id)?.properties?.some(propriedade =>
    propriedade.name === "Luzatravessa" && propriedade.value === true) ?? false;
  const border = walls.obterPoligono(-1000,-5290);
  assert.equal(visivel(border, -930,-5290), true, "a luz chega até a colisão 282");
  assert.equal(visivel(border, -905,-5290), true, "a superfície da colisão 282 permanece iluminada");
  assert.equal(visivel(border, -840,-5290), permiteLuz(282), "a colisão 282 respeita a configuração atual de Luzatravessa");
  const object = walls.obterPoligono(-1330,-4940);
  assert.equal(visivel(object, -1250,-4940), true, "a estrutura de produção real recebe luz");
  assert.equal(visivel(object, -1180,-4940), permiteLuz(518), "a estrutura respeita a configuração atual de Luzatravessa");

  for (const x of [-650, -430, -400]) {
    assert.equal(visivel(walls.obterPoligono(x, -1350), x, -1430), false,
      "o contorno normal reproduz a lanterna presa dentro da parede da fachada");
    assert.equal(visivel(walls.obterPoligono(x, -1350, regiao), x, -1430), true,
      "dentro do gatilho real a luz sai da fachada e alcança o interior da sala");
    assert.equal(visivel(walls.obterPoligono(x, -1350), x, -1430), false,
      "sair do gatilho restaura o bloqueio sem precisar mudar a origem da lanterna");
  }

  const atravessaveis = objects.filter(objeto => objeto.properties?.some(propriedade =>
    propriedade.name === "Luzatravessa" && propriedade.value === true));
  assert.ok(atravessaveis.length > 0, "o mapa real tem colisões que permitem passar luz");
  for (const objeto of atravessaveis) {
    // Isola cada exceção: paredes vizinhas continuam podendo obstruir o caminho no mapa.
    const excecao = new FlashlightWalls(cena([objeto]));
    assert.equal(excecao.obterPoligono(objeto.x - 10, objeto.y - 10).length, 0,
      `a colisão ${objeto.id} marcada no mapa real não cria contornos de sombra`);
    excecao.destroy();
  }
});
