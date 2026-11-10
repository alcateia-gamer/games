/** Item 3: quadro e tempo comuns no Phaser real, para os quatro ataques. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = {
  ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
  // Mantém o mesmo grupo vivo durante a sequência de quatro ataques do roteiro.
  ilusoes: { ...novoBossConfig.ilusoes, duracaoMs: 60000 },
  clones: { ...novoBossConfig.clones, duracaoMs: 60000 },
  // A sequência estendida verifica animações; teleporte encerra as aparições.
  teleporte: { ...novoBossConfig.teleporte, preventivoMs: 600000 },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar } = sessao;

async function verificarAtaque(tipo, quantidade) {
  return page.evaluate(async ({ tipo, quantidade }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const boss = scene.novoBoss;
    const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
    const verificar = (emAtaque, tempo) => {
      const sprite = boss.sprite;
      const alvos = boss.alvosIlusorios.filter(alvo => alvo.active);
      if (alvos.length !== quantidade) throw new Error(
        `${tipo} em ${tempo} ms: cópias=${alvos.length}, esperado=${quantidade}, estado=${boss.estado}, vidaPlayer=${scene.vida}`);
      for (const alvo of alvos) {
        if (alvo.sprite.texture.key !== sprite.texture.key) throw new Error(`Folha diferente em ${tempo} ms`);
        if (emAtaque && (alvo.sprite.frame.name !== sprite.frame.name ||
            alvo.sprite.anims.isPlaying !== sprite.anims.isPlaying ||
            alvo.sprite.anims.accumulator !== sprite.anims.accumulator)) {
          throw new Error(`Animação dessincronizada em ${tempo} ms: real=${sprite.frame.name}, cópia=${alvo.sprite.frame.name}`);
        }
        const area = alvo.hitboxDano;
        if (Math.abs(area.x - (alvo.x - 30.8)) > 0.001 ||
            Math.abs(area.y - (alvo.y - 37.4)) > 0.001) throw new Error("Hitbox deslocada.");
      }
    };
    if (!boss.executarAtaque(tipo)) throw new Error(`Não iniciou ${tipo}`);
    atualizarBoss(scene, scene.time.now, 0);
    // Ataques centrais só começam após concluir os dois estágios do teleporte.
    for (let preparo = 0; boss.ataquePendente && preparo < 2000; preparo += 20) {
      atualizarBoss(scene, scene.time.now, 20);
    }
    if (!boss.ataqueAtual) throw new Error("O posicionamento não iniciou o ataque.");
    verificar(true, 0);
    if (boss.sprite.frame.name !== 0) throw new Error("Uma nova execução precisa iniciar no quadro zero.");
    const quadros = new Set([0]);
    let tempo = 0;
    let amostras = 1;
    while (boss.ataqueAtual && tempo < 20000) {
      // Mesma ordem do Phaser: preUpdate dos sprites antes do update da cena.
      // Intercala frames longos para verificar a recuperação de quadros perdidos.
      const delta = amostras % 31 === 0 ? 200 : 16;
      boss.sprite.preUpdate(scene.time.now + tempo, delta);
      for (const alvo of boss.alvosIlusorios) {
        if (alvo.active) alvo.sprite.preUpdate(scene.time.now + tempo, delta);
      }
      atualizarBoss(scene, scene.time.now + tempo, delta);
      tempo += delta;
      verificar(Boolean(boss.ataqueAtual), tempo);
      if (boss.ataqueAtual) quadros.add(Number(boss.sprite.frame.name));
      amostras++;
    }
    if (boss.ataqueAtual) throw new Error("Ataque não terminou.");
    if (boss.sprite.texture.key !== "novo-boss-idle") throw new Error("Não retornou à espera.");
    return { tipo, quantidade, tempo, amostras, quadros: [...quadros] };
  }, { tipo, quantidade });
}

try {
  for (const [grupo, quantidade] of [["ilusoes", 3], ["clones", 9]]) {
    if (grupo === "clones") await sessao.reiniciar({
      novoBossConfig: { ...config, fase2: novoBossConfig.fase2 },
    });
    await sessao.posicionar(-590, -5520);
    assert.ok(await page.evaluate(async grupo => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      const boss = scene.novoBoss;
      if (grupo === "ilusoes") return boss.iniciarIlusoes();
      const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
      for (let i = 0; boss.estado !== "vulneravel" && i < 500; i++) {
        atualizarBoss(scene, scene.time.now, 20);
      }
      if (!boss.receberDano(501)) throw new Error("Não atingiu a verdadeira na abertura.");
      for (let i = 0; !boss.sistemaClones.ativo && i < 500; i++) {
        atualizarBoss(scene, scene.time.now, 20);
      }
      return boss.fase === 2 && boss.sistemaClones.ativo;
    }, grupo));
    const inicioGrupo = await page.evaluate(() => {
      const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
      return { x: boss.x, y: boss.y };
    });
    const resultados = [];
    for (const tipo of ["pulso", "chuva", "lasers", "tentaculos"]) {
      const resultado = await verificarAtaque(tipo, quantidade);
      assert.ok(resultado.amostras > 20);
      assert.ok(resultado.quadros.some(quadro => quadro > 0));
      if (tipo === "chuva" || tipo === "tentaculos") {
        assert.ok(resultado.quadros.includes(47), "Ataques longos devem alcançar e conservar o último quadro.");
      }
      resultados.push({ tipo, amostras: resultado.amostras, tempo: resultado.tempo });
    }
    if (grupo === "clones") {
      assert.ok(await page.evaluate(inicio => {
        const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
        return Math.hypot(boss.x - inicio.x, boss.y - inicio.y) > 1;
      }, inicioGrupo), "A verdadeira deve continuar se movendo na segunda fase.");
    }
    console.log(`PASS: ${grupo}, quatro ataques completos sincronizados por quadro e relógio, com retorno conjunto à espera. ${JSON.stringify(resultados)}`);

    // Reprodução com a cena ativa também precisa coincidir na saída de cada update.
    await page.evaluate(() => {
      window.__amostrasSincronia = [];
      const scene = window.__game.scene.getScene("Level1Parte2");
      const boss = scene.novoBoss;
      scene.events.on("postupdate", window.__observarSincronia = () => {
        if (!boss.ataqueAtual) return;
        window.__amostrasSincronia.push({ frame: Number(boss.sprite.frame.name),
          iguais: boss.alvosIlusorios.filter(alvo => alvo.active).every(alvo =>
            alvo.sprite.frame.name === boss.sprite.frame.name &&
            alvo.sprite.anims.isPlaying === boss.sprite.anims.isPlaying) });
      });
      if (!boss.executarAtaque("tentaculos")) throw new Error("Não iniciou ataque na cena ativa.");
    });
    await sessao.retomar();
    await page.waitForTimeout(600);
    await sessao.pausar();
    const amostras = await page.evaluate(() => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      scene.events.off("postupdate", window.__observarSincronia);
      return window.__amostrasSincronia;
    });
    assert.ok(amostras.length > 2);
    assert.ok(amostras.every(amostra => amostra.iguais));
    assert.ok(amostras.some(amostra => amostra.frame > 0));

    // Dissipar uma cópia e cancelar o ataque não deve deixar poses presas.
    assert.ok(await page.evaluate(() => {
      const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
      const alvo = boss.alvosIlusorios.find(alvo => alvo.active);
      window.__copiaDissipadaSincronia = alvo.sprite;
      return alvo.receberDano(1);
    }));
    await avancar(0);
    await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").novoBoss.cancelarAtaque(); });
    await avancar(0);
    assert.ok(await page.evaluate(() => {
      const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
      return !window.__copiaDissipadaSincronia.active && boss.alvosIlusorios
        .filter(alvo => alvo.active).every(alvo => alvo.sprite.texture.key === "novo-boss-idle");
    }));
    console.log(`PASS: ${grupo}, cena ativa, dissipação e cancelamento preservam a sincronia das cópias vivas.`);
  }
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  assert.deepEqual(sessao.consoleErrors, []);
} finally {
  await sessao.fechar();
}
