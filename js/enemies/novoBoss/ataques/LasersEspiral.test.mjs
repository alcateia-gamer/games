import assert from "node:assert/strict";
import test from "node:test";
import { criarLasersEspiral } from "./LasersEspiral.js";
import { novoBossConfig } from "../NovoBossConfig.js";

function preparar(config = {}, extras = {}, usarVisuais = false) {
  const avisos = [];
  const graficos = [];
  const visuais = [];
  const registrados = new Set();
  const movimentos = [];
  const danos = [];
  const encontro = { x: 0, y: 0, config: {
    arena: { xMin: -1000, xMax: 1000, yMin: -1000, yMax: 1000 },
  } };
  const scene = { player: { x: 100, y: 0 }, add: {
    graphics() {
      const g = { destruicoes: 0 };
      for (const nome of ["setDepth", "clear", "lineStyle", "beginPath", "moveTo", "lineTo", "strokePath", "fillStyle", "fillCircle"]) {
        g[nome] = () => g;
      }
      g.destroy = () => g.destruicoes++;
      graficos.push(g);
      return g;
    },
    ...(usarVisuais ? { circle(x, y) {
      const visual = { x, y, active: true, destruicoes: 0,
        body: { velocity: { x: 0, y: 0 }, setVelocity(x, y) { this.velocity = { x, y }; }, updateFromGameObject() {} },
        setPosition(x, y) { this.x = x; this.y = y; }, setDepth() {},
        destroy() { this.active = false; this.destruicoes++; },
      };
      visuais.push(visual);
      return visual;
    } } : {}),
  } };
  const servicos = {
    criarAviso(x, y, raio) {
      const aviso = { x, y, raio, destruicoes: 0, progresso: 0,
        atualizar(progresso) { this.progresso = progresso; },
        destruir() { this.destruicoes++; },
      };
      avisos.push(aviso);
      return aviso;
    },
    segmentoBloqueado: () => false,
    atingirJogadorComLaser(inicio, fim, raio, dano) {
      movimentos.push({ inicio, fim, raio });
      if (inicio.x <= scene.player.x && fim.x + raio >= scene.player.x && Math.abs(fim.y - scene.player.y) <= raio) {
        danos.push(dano);
        return true;
      }
      return false;
    },
    registrarLaser(visual) { registrados.add(visual); },
    desregistrarLaser(visual) { registrados.delete(visual); },
    ...extras,
  };
  const ataque = criarLasersEspiral(scene, encontro, config, servicos);
  return { ataque, scene, encontro, avisos, graficos, danos, movimentos, visuais, registrados };
}

test("agenda do prólogo emite anéis simultâneos e mantém as varreduras existentes", () => {
  const c = preparar({ avisoMs: 100, quantidade: 4, emissoes: [
    { em: 0, angulo: 0 }, { em: 0, angulo: 90 },
    { em: 600, angulo: 180 }, { em: 600, angulo: 270 },
  ] }, { atingirJogadorComLaser: () => false });
  c.ataque.atualizar(99); assert.equal(c.ataque.snapshot().emitidos, 0);
  c.ataque.atualizar(1); assert.equal(c.ataque.snapshot().emitidos, 2);
  c.ataque.atualizar(600); assert.equal(c.ataque.snapshot().emitidos, 4);
  assert.equal(c.ataque.snapshot().projeteis.length, 4);
  assert.ok(c.ataque.snapshot().projeteis.every(p => Math.abs(Math.hypot(p.dx, p.dy) - 1) < 1e-8));
  assert.equal(c.ataque.atualizar(10000), true);
});

test("lasers de produção aceleram sem dano durante o aviso e acertam com dano multiplicado", () => {
  for (const config of [novoBossConfig.ataques.lasersEspiral, novoBossConfig.prologo.lasers]) {
    const c = preparar(config);
    c.ataque.atualizar(config.avisoMs - 1);
    assert.deepEqual(c.danos, []);
    assert.equal(c.ataque.snapshot().emitidos, 0);
    c.ataque.atualizar(1);
    c.ataque.atualizar(100);
    assert.ok(Math.abs(c.ataque.snapshot().projeteis[0].x - config.velocidade * 0.1) < 1e-9);
    c.ataque.atualizar(800);
    assert.equal(c.danos[0], 20);
  }
});

test("espiral avisa antes de emitir e não causa perigo durante o aviso", () => {
  const c = preparar();
  assert.equal(c.avisos.length, 1);
  assert.equal(c.ataque.atualizar(699), false);
  assert.equal(c.ataque.snapshot().emitidos, 0);
  assert.equal(c.movimentos.length, 0);
  assert.equal(c.avisos[0].destruicoes, 0);
  c.ataque.atualizar(1);
  assert.equal(c.avisos[0].destruicoes, 1);
  assert.equal(c.ataque.snapshot().emitidos, 1);
  assert.equal(c.ataque.snapshot().avisando, false);
});

test("emissões rotacionam 22,5 graus sem alterar a velocidade nem usar offsets de robôs", () => {
  const c = preparar({ quantidade: 4, anguloInicial: 90 }, { atingirJogadorComLaser: () => false });
  c.ataque.atualizar(1060);
  const snapshot = c.ataque.snapshot();
  assert.equal(snapshot.emitidos, 4);
  assert.equal(snapshot.projeteis.length, 4);
  snapshot.projeteis.forEach((p, i) => {
    assert.ok(Math.abs(Math.atan2(p.dy, p.dx) - (90 + i * 22.5) * Math.PI / 180) < 1e-10);
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - (360 - i * 120) * 0.115) < 1e-8);
  });
});

test("delta longo varre o percurso inteiro e causa um só impacto no jogador", () => {
  const c = preparar({ quantidade: 1, avisoMs: 0, velocidade: 500 });
  assert.equal(c.ataque.atualizar(1000), true);
  assert.deepEqual(c.danos, [10]);
  assert.ok(c.movimentos.length > 1);
  assert.ok(c.movimentos.every(({ inicio, fim }) => Math.hypot(fim.x - inicio.x, fim.y - inicio.y) <= 6.00001));
  assert.equal(c.ataque.atualizar(1000), true);
  assert.deepEqual(c.danos, [10]);
});

test("paredes consomem o laser e protegem o jogador atrás delas", () => {
  const c = preparar({ quantidade: 1, avisoMs: 0, velocidade: 500 }, {
    segmentoBloqueado: (inicio, fim) => inicio.x <= 45 && fim.x >= 45,
  });
  c.ataque.atualizar(1000);
  assert.deepEqual(c.danos, []);
  assert.ok(c.movimentos.every(({ fim }) => fim.x < 45));
  assert.equal(c.ataque.snapshot().terminado, true);
});

test("um jogador antes da parede ainda é atingido em um frame longo", () => {
  const c = preparar({ quantidade: 1, avisoMs: 0, velocidade: 500 }, {
    segmentoBloqueado: (inicio, fim) => inicio.x <= 160 && fim.x >= 160,
  });
  c.ataque.atualizar(1000);
  assert.deepEqual(c.danos, [10]);
});

test("toda execução termina por alcance ou vida e libera todos os visuais registrados", () => {
  const c = preparar({}, { atingirJogadorComLaser: () => false }, true);
  assert.equal(c.ataque.atualizar(100000), true);
  assert.equal(c.ataque.snapshot().emitidos, 28);
  assert.equal(c.ataque.snapshot().projeteis.length, 0);
  assert.equal(c.registrados.size, 0);
  assert.ok(c.visuais.every((v) => v.destruicoes === 1));
  assert.equal(c.graficos[0].destruicoes, 1);
});

test("cancelar é idempotente e remove aviso, corpo e visual de todos os projéteis", () => {
  const c = preparar({}, { atingirJogadorComLaser: () => false }, true);
  c.ataque.atualizar(1000);
  assert.ok(c.registrados.size > 0);
  c.ataque.destruir();
  c.ataque.destruir();
  assert.equal(c.avisos[0].destruicoes, 1);
  assert.equal(c.graficos[0].destruicoes, 1);
  assert.equal(c.registrados.size, 0);
  assert.ok(c.visuais.every((v) => v.destruicoes === 1));
  assert.equal(c.ataque.atualizar(999), true);
});

test("lasers destruídos por Magnus ou Nyx são desregistrados sem gerar novo dano", () => {
  const c = preparar({ quantidade: 1 }, {}, true);
  c.ataque.atualizar(700);
  c.visuais[0].destroy();
  assert.equal(c.ataque.atualizar(1000), true);
  assert.equal(c.registrados.size, 0);
  assert.equal(c.visuais[0].destruicoes, 1);
  assert.equal(c.danos.length, 0);
});

test("laser refletido muda de direção e equipe e usa o dano especial", () => {
  let impactosRefletidos = 0;
  const c = preparar({ quantidade: 1, avisoMs: 0 }, {
    atingirJogadorComLaser(inicio, fim, raio, dano, origem, visual) {
      if (fim.x >= 24) {
        visual.especialRefletido = true;
        visual.danoEspecial = 30;
        visual.body.setVelocity(-530, 0);
        return true;
      }
      return false;
    },
    atingirAlvoComLaserRefletido(inicio, fim, raio, dano, visual) {
      assert.equal(dano, 30);
      assert.equal(visual.especialRefletido, true);
      if (fim.x <= 0) { impactosRefletidos++; return true; }
      return false;
    },
  }, true);
  assert.equal(c.ataque.atualizar(1000), true);
  assert.equal(impactosRefletidos, 1);
  assert.equal(c.registrados.size, 0);
});

test("delta inválido não emite nem avança o ataque", () => {
  const c = preparar();
  c.ataque.atualizar(-10);
  c.ataque.atualizar(NaN);
  assert.equal(c.ataque.snapshot().decorrido, 0);
  assert.equal(c.ataque.snapshot().emitidos, 0);
});

test("configuração real emite cem disparos durante dez segundos depois do aviso", () => {
  const c = preparar({ ...novoBossConfig.ataques.lasersEspiral, vidaProjetilMs: 0 });
  c.ataque.atualizar(699);
  assert.equal(c.ataque.snapshot().emitidos, 0);
  c.ataque.atualizar(1);
  assert.equal(c.ataque.snapshot().emitidos, 1);
  assert.equal(c.ataque.snapshot().emitindo, true);
  assert.equal(c.ataque.atualizar(9999), false);
  assert.equal(c.ataque.snapshot().emitidos, 100);
  assert.equal(c.ataque.snapshot().emitindo, true);
  assert.equal(c.ataque.atualizar(1), true);
  assert.equal(c.ataque.snapshot().emitindo, false);
  assert.equal(c.ataque.snapshot().emitidos, 100, "Não emite um 101º disparo na fronteira.");
});

function colherDirecoes(config) {
  const c = preparar({ ...config, anguloInicial: 0 }, { atingirJogadorComLaser: () => false });
  const angulos = [];
  for (let i = 0; i < 100; i++) {
    c.ataque.atualizar(i === 0 ? config.avisoMs : config.intervaloMs);
    const p = c.ataque.snapshot().projeteis.at(-1);
    angulos.push((Math.atan2(p.dy, p.dx) * 180 / Math.PI + 360) % 360);
  }
  return { c, angulos };
}

test("voltas alternadas ocupam os vãos antigos e seis voltas reduzem a lacuna a 3,75 graus", () => {
  const { angulos } = colherDirecoes(novoBossConfig.ataques.lasersEspiral);
  for (const [volta, fase] of [0, 11.25, 3.75, 15, 7.5, 18.75].entries()) {
    assert.ok(Math.abs(angulos[volta * 16] - fase) < 1e-8);
  }
  const primeira = angulos.slice(0, 16);
  const segunda = angulos.slice(16, 32);
  assert.ok(segunda.every((a, i) => Math.abs(a - primeira[i] - 11.25) < 1e-8));
  const ordenados = angulos.slice(0, 96).sort((a, b) => a - b);
  const lacunas = ordenados.map((a, i) => (ordenados[(i + 1) % 96] + 360 - a) % 360);
  assert.ok(lacunas.every(d => Math.abs(d - 3.75) < 1e-8));
  assert.equal(new Set(angulos.map(a => a.toFixed(6))).size, 100);
});

test("ficar parado num vão da primeira volta deixa de evitar a espiral seguinte", () => {
  function simular(intercalar) {
    const angulo = 11.25 * Math.PI / 180;
    const alvo = { x: Math.cos(angulo) * 200, y: Math.sin(angulo) * 200 };
    let impactos = 0;
    const c = preparar({ ...novoBossConfig.ataques.lasersEspiral, anguloInicial: 0, intercalar }, {
      atingirJogadorComLaser(inicio, fim, raio) {
        // Um corpo circular de diâmetro 32; o segmento é subdividido em até 6 px.
        if (Math.hypot(fim.x - alvo.x, fim.y - alvo.y) <= 16 + raio) { impactos++; return true; }
        return false;
      },
    });
    for (let i = 0; i < 800; i++) c.ataque.atualizar(20);
    return impactos;
  }
  assert.equal(simular(false), 0);
  assert.ok(simular(true) > 0);
});

test("dez segundos não dependem do FPS nem de projéteis sobreviventes no mapa", () => {
  const config = novoBossConfig.ataques.lasersEspiral;
  const grande = preparar(config, { atingirJogadorComLaser: () => false });
  const pequeno = preparar(config, { atingirJogadorComLaser: () => false });
  grande.ataque.atualizar(10700);
  for (let i = 0; i < 535; i++) pequeno.ataque.atualizar(20);
  for (const chave of ["decorrido", "emitidos", "emitindo", "terminado"]) {
    assert.equal(grande.ataque.snapshot()[chave], pequeno.ataque.snapshot()[chave]);
  }
  const a = grande.ataque.snapshot().projeteis, b = pequeno.ataque.snapshot().projeteis;
  assert.equal(a.length, b.length);
  a.forEach((p, i) => {
    for (const chave of ["x", "y", "dx", "dy", "idade"]) assert.ok(Math.abs(p[chave] - b[i][chave]) < 1e-6);
  });
  assert.equal(grande.ataque.snapshot().emitindo, false);
  assert.equal(grande.ataque.snapshot().terminado, false, "Últimos projéteis ainda podem viajar após a emissão.");
  grande.ataque.atualizar(6000);
  assert.equal(grande.ataque.snapshot().terminado, true);
  const bloqueado = preparar(config, { segmentoBloqueado: () => true });
  assert.equal(bloqueado.ataque.atualizar(10699), false);
  assert.equal(bloqueado.ataque.atualizar(1), true);
});

test("cancelar no meio da emissão longa desregistra os lasers e impede novos disparos", () => {
  const c = preparar(novoBossConfig.ataques.lasersEspiral, { atingirJogadorComLaser: () => false }, true);
  c.ataque.atualizar(5000);
  assert.ok(c.registrados.size > 0);
  const emitidos = c.ataque.snapshot().emitidos;
  c.ataque.destruir();
  c.ataque.destruir();
  c.ataque.atualizar(10000);
  assert.equal(c.registrados.size, 0);
  assert.equal(c.ataque.snapshot().emitidos, emitidos);
  assert.ok(c.visuais.every(v => v.destruicoes === 1));
});

test("absorver um disparo encerra a varredura no mesmo quadro sem atingir outro jogador", () => {
  let impactos = 0, refletidos = 0;
  const c = preparar({ avisoMs: 0, quantidade: 1, emissoes: [{ em: 0, angulo: 0 }] }, {
    atingirJogadorComLaser(_inicio, _fim, _raio, _dano, _origem, visual) {
      impactos++;
      visual.destroy();
      return true;
    },
    atingirAlvoComLaserRefletido() { refletidos++; return false; },
  }, true);
  c.ataque.atualizar(1000);
  assert.equal(impactos, 1);
  assert.equal(refletidos, 0);
  assert.equal(c.visuais[0].active, false);
  assert.equal(c.registrados.size, 0);
  assert.equal(c.ataque.snapshot().projeteis.length, 0);
});
