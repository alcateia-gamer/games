/** Item 4: ataques completos e comparação com o combate sem cópias no Phaser. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = {
  ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
  ilusoes: { ...novoBossConfig.ilusoes, duracaoMs: 60000 },
  clones: { ...novoBossConfig.clones, duracaoMs: 60000 },
  teleporte: { ...novoBossConfig.teleporte, preventivoMs: 600000 },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar } = sessao;

async function preparar(grupo) {
  await sessao.reiniciar();
  await sessao.posicionar(-680, -5770);
  await page.evaluate(async grupo => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const boss = scene.novoBoss;
    const { sincronizarCorpoNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    boss.rng = () => 0;
    if (grupo === 3) {
      if (!boss.iniciarIlusoes()) throw new Error("Não criou as quatro aparições.");
    } else {
      sincronizarCorpoNovoBoss(boss, { x: -1400, y: -5770 });
      if (grupo === 9) {
        if (!boss.iniciarClones()) throw new Error("Não criou os nove clones.");
        // Coloca uma cópia próxima do jogador, longe do alcance da verdadeira.
        boss.alvosIlusorios[0].posicionar({ x: -760, y: -5770 });
      }
    }
    // O sorteio constante serve à troca de posição; os ataques usam uma sequência
    // reproduzível que permite encontrar todas as armadilhas no mapa real.
    let semente = 123456789;
    boss.rng = () => {
      semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0;
      return semente / 2 ** 32;
    };
    for (const nome of ["tentarInterceptarLaserEspecial", "acertarHologramaEspecial"]) {
      const original = scene[nome]?.bind(scene);
      scene[nome] = visual => {
        if (visual?.novoBossAtaqueIlusorio) throw new Error("Laser ilusório entrou nas defesas reais.");
        return original?.(visual);
      };
    }
  }, grupo);
  await avancar(0);
}

async function executar(tipo, grupo) {
  await preparar(grupo);
  return page.evaluate(async ({ tipo, grupo }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const boss = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const { atualizarHitboxDanoPlayer } = await import("/js/player/Player.js");
    const hpInicial = scene.vida;
    const efeitos = () => scene.children.list.filter(o => o.active && o.novoBossAtaqueIlusorio);
    const inicial = { x: scene.player.x, y: scene.player.y };
    const marcas = [];
    const assinatura = [];
    let ultima = null;
    let tempo = 0;
    let maxEfeitos = 0;
    let cruzouLaser = false;
    let dissipou = false;
    const emissoes = new Map();
    const donos = new Set();
    if (!boss.executarAtaque(tipo)) throw new Error(`Não iniciou ${tipo}`);
    atualizarNovoBoss(scene, scene.time.now, 0);
    for (let preparo = 0; boss.ataquePendente && preparo < 2000; preparo += 20) {
      scene.time.preUpdate();
      scene.time.update(scene.time.now + 20, 20);
      atualizarNovoBoss(scene, scene.time.now, 20);
    }
    if (!boss.ataqueAtual) throw new Error("Não iniciou o ataque após o posicionamento.");
    for (const alvo of boss.alvosIlusorios) {
      const copia = alvo.ataquesIlusorios.snapshot();
      if (!copia.ativo || copia.tipo !== tipo) throw new Error("Cópia não iniciou junto com a verdadeira.");
      marcas.push({ id: alvo.id, chuva: copia.execucao?.marcas?.length,
        tentaculos: copia.execucao?.armadilhas?.length });
    }
    function observar() {
      const estado = { vida: scene.vida, invulneravel: Boolean(scene.player.invulneravel),
        presa: Boolean(scene.restricaoControleNovoBoss),
        vx: scene.player.body.velocity.x, vy: scene.player.body.velocity.y };
      const valor = JSON.stringify(estado);
      if (ultima !== valor) { assinatura.push({ tempo, ...estado }); ultima = valor; }
      if (scene.player.x !== inicial.x || scene.player.y !== inicial.y) throw new Error("Jogador foi deslocado.");
      if (boss.vida !== 1000) throw new Error("Ataque de uma cópia alterou a vida da verdadeira.");
      maxEfeitos = Math.max(maxEfeitos, efeitos().length);
      for (const objeto of efeitos()) {
        donos.add(objeto.novoBossDonoIlusao);
        if (objeto.body || boss.projeteisBoss.includes(objeto) || objeto.especialLaserInimigo) {
          throw new Error("Efeito ilusório recebeu corpo ou registro ofensivo.");
        }
      }
      for (const alvo of boss.alvosIlusorios.filter(a => a.active)) {
        const copia = alvo.ataquesIlusorios.snapshot();
        if (copia.execucao) {
          if (copia.tempo !== boss.tempoAtaque) throw new Error("Relógio da cópia divergiu.");
          if (copia.execucao.armadilhas?.some(a => a.capturou || a.segurando)) throw new Error("Cópia capturou.");
          if (copia.execucao.emitidos !== undefined) {
            emissoes.set(alvo.id, Math.max(emissoes.get(alvo.id) ?? 0, copia.execucao.emitidos));
            const area = scene.hitboxDanoPlayer;
            cruzouLaser ||= copia.execucao.projeteis.some(p => p.x >= area.x - p.raio &&
              p.x <= area.x + area.width + p.raio && p.y >= area.y - p.raio &&
              p.y <= area.y + area.height + p.raio);
          }
        }
      }
    }
    observar();
    while (boss.ataqueAtual && tempo < 20000) {
      // Na chuva mirada, recebe o primeiro impacto e depois segue uma rota
      // determinística. Evita morrer parado e compara os mesmos deslocamentos
      // com/sem cópias, sem alterar vida, defesas ou parâmetros do ataque.
      if (tipo === "chuva" && tempo >= 1500 && (tempo - 1500) % 600 === 0) {
        const indice = [1, 3, 2, 0][Math.floor((tempo - 1500) / 600) % 4];
        const ponto = boss.config.teleporte.pontos[indice];
        scene.player.setPosition(ponto.x, ponto.y);
        scene.player.body.reset(ponto.x, ponto.y);
        scene.player.body.updateFromGameObject();
        scene.player.body.setVelocity(0, 0);
        atualizarHitboxDanoPlayer(scene);
        Object.assign(inicial, { x: ponto.x, y: ponto.y });
      }
      scene.time.preUpdate();
      scene.time.update(scene.time.now + 20, 20);
      atualizarNovoBoss(scene, scene.time.now, 20);
      tempo += 20;
      // Destruir uma cópia não pode soltar o agarrão aplicado pela verdadeira.
      if (grupo && tipo === "tentaculos" && tempo === 1200) {
        const fonte = scene.restricaoControleNovoBoss?.fonte;
        if (!fonte) throw new Error("A verdadeira deveria estar segurando o jogador.");
        const alvo = boss.alvosIlusorios.find(a => a.active);
        dissipou = alvo.receberDano(1);
        if (scene.restricaoControleNovoBoss?.fonte !== fonte) throw new Error("Cópia liberou a captura real.");
        if (efeitos().some(o => o.novoBossDonoIlusao === alvo.id)) throw new Error("Restaram efeitos da cópia dissipada.");
      }
      observar();
    }
    if (boss.ataqueAtual) throw new Error("Ataque não terminou.");
    // Conclui a cauda dos oito quadros da explosão após o fim do pulso.
    for (let i = 0; i < 35; i++) {
      scene.time.preUpdate();
      scene.time.update(scene.time.now + 20, 20);
      atualizarNovoBoss(scene, scene.time.now, 20);
      tempo += 20;
      observar();
    }
    if (efeitos().length) throw new Error("Ataque concluído deixou efeitos ilusórios ativos.");
    return { dano: hpInicial - scene.vida, assinatura, marcas, maxEfeitos,
      cruzouLaser, dissipou, emissoes: [...emissoes.values()], donos: donos.size };
  }, { tipo, grupo });
}

try {
  const baselines = new Map();
  for (const tipo of ["pulso", "chuva", "lasers", "tentaculos"]) {
    baselines.set(tipo, await executar(tipo, 0));
  }
  assert.equal(baselines.get("pulso").dano, 0);
  assert.ok(baselines.get("lasers").dano > 0, "A espiral central deve atingir um jogador parado.");
  assert.ok(baselines.get("chuva").dano >= 16, "A sequência verdadeira deve continuar causando dano.");
  assert.ok(baselines.get("tentaculos").assinatura.some(a => a.presa));
  for (const grupo of [3, 9]) {
    for (const tipo of ["pulso", "chuva", "lasers", "tentaculos"]) {
      const resultado = await executar(tipo, grupo);
      assert.deepEqual(resultado.assinatura, baselines.get(tipo).assinatura,
        `${grupo} cópias não podem adicionar dano, invulnerabilidade, repulsão ou captura (${tipo}).`);
      assert.equal(resultado.marcas.length, grupo);
      assert.equal(resultado.donos, grupo);
      assert.ok(resultado.maxEfeitos > 0);
      if (tipo === "chuva") assert.ok(resultado.marcas.every(a => a.chuva === config.ataques.chuvaRaios.quantidade));
      if (tipo === "tentaculos") {
        assert.ok(resultado.marcas.every(a => a.tentaculos === 3));
        assert.ok(resultado.dissipou);
      }
      if (tipo === "lasers") {
        assert.ok(resultado.cruzouLaser, "Um laser ilusório deve atravessar o jogador sem dano.");
        assert.ok(resultado.emissoes.every(n => n === 100), JSON.stringify(resultado.emissoes));
      }
      console.log(`PASS: ${grupo} cópias, ${tipo} completo; vida e controles idênticos ao combate sem cópias, com limpeza integral.`);
    }
  }

  // Limpeza imediata durante um ataque, ainda com projéteis em voo.
  for (const motivo of ["cancelar", "sair", "morrer", "multiplayer", "reiniciar"]) {
    await preparar(9);
    await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("lasers"); });
    await avancar(1500);
    const antes = await page.evaluate(() => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      window.__efeitosIlusoriosAntes = scene.children.list.filter(o => o.active && o.novoBossAtaqueIlusorio);
      return window.__efeitosIlusoriosAntes.length;
    });
    assert.ok(antes > 0);
    if (motivo === "reiniciar") await sessao.reiniciar();
    else {
      await page.evaluate(motivo => {
        const scene = window.__game.scene.getScene("Level1Parte2");
        if (motivo === "cancelar") scene.novoBoss.cancelarAtaque();
        if (motivo === "sair") scene.player.setPosition(-1093, -5350);
        if (motivo === "morrer") scene.morteEmAndamento = true;
        if (motivo === "multiplayer") scene.multiplayer = true;
      }, motivo);
      await avancar(0);
    }
    assert.ok(await page.evaluate(() => window.__efeitosIlusoriosAntes.every(o => !o.active)));
    console.log(`PASS: ${motivo} remove todos os efeitos ilusórios imediatamente.`);
  }
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  assert.deepEqual(sessao.consoleErrors, []);
} finally {
  await sessao.fechar();
}
