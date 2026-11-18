import test from "node:test";
import assert from "node:assert/strict";
import { criarPagamentoRecompensa } from "./PagamentoRecompensa.js";

const token = conta => `header.${Buffer.from(JSON.stringify({ sub: conta })).toString("base64url")}.signature`;
const solo = { tempoMs: 14 * 60000, recompensa: { partida: "solo:exemplo", participantes: ["solo"] } };
const coop = { tempoMs: 16 * 60000, recompensa: { partida: "coop:TEST:hollow:123", participantes: ["host", "cliente"] } };

function ambiente(conta, registros = new Map()) {
  const env = {
    chamadas: [],
    autenticar: async () => token(conta),
    async creditar(dados, opcoes) {
      env.chamadas.push([dados, opcoes.headers.Authorization]);
      return { status: 201, data: { operation: 123 } };
    },
    registro: {
      async obter(partida, jogador) { return registros.get(JSON.stringify([partida, jogador]))?.estado; },
      async reservar(partida, jogador, dono) {
        const anterior = [...registros.values()].find(p => p.partida === partida && (p.jogador === jogador || p.dono === dono));
        if (anterior) return { estado: anterior.estado };
        await this.salvar(partida, jogador, dono, { tipo: "pendente" });
        return { reservado: true };
      },
      async salvar(partida, jogador, dono, estado) {
        registros.set(JSON.stringify([partida, jogador]), { partida, jogador, dono, estado });
      },
    },
  };
  return env;
}

function acompanhar(pagamentos, partida, jogador, estados = []) {
  return new Promise(resolve => {
    pagamentos.iniciar(partida, jogador, jogador !== "solo").observar(estado => {
      estados.push(estado.tipo);
      if (estado.tipo !== "pendente" || estados.length > 1) {
        if (!["autenticacao", "processando"].includes(estado.tipo)) resolve(estado);
      }
    });
  });
}

test("solo solicita o crédito do produto 85 para a conta autenticada e preserva a confirmação ao reabrir", async () => {
  const env = ambiente("conta-solo");
  const pagamentos = criarPagamentoRecompensa(env);
  const estados = [];
  const primeiro = acompanhar(pagamentos, solo, "solo", estados);
  const repetido = acompanhar(pagamentos, solo, "solo");
  const confirmado = { tipo: "confirmado", quantidade: 550, operacao: 123 };
  assert.deepEqual(await primeiro, confirmado);
  assert.deepEqual(await repetido, confirmado);
  assert.deepEqual(await acompanhar(criarPagamentoRecompensa(env), solo, "solo"), confirmado);
  assert.ok(estados.includes("processando"));
  assert.deepEqual(env.chamadas, [[{ product: 85, value: 550 }, `Bearer ${token("conta-solo")}`]]);
});

test("a mesma conta em duas instâncias do navegador só reserva um crédito por partida", async () => {
  const registros = new Map();
  const a = ambiente("conta-compartilhada", registros);
  const b = ambiente("conta-compartilhada", registros);
  await Promise.all([
    acompanhar(criarPagamentoRecompensa(a), coop, "host"),
    acompanhar(criarPagamentoRecompensa(b), coop, "cliente"),
  ]);
  assert.equal(a.chamadas.length + b.chamadas.length, 1);
});

test("resultado do host vale para duas contas, inclusive após reconexão e troca de autoridade", async () => {
  const host = ambiente("conta-do-host");
  const cliente = ambiente("conta-do-cliente");
  const [a, b] = await Promise.all([
    acompanhar(criarPagamentoRecompensa(host), coop, "host"),
    acompanhar(criarPagamentoRecompensa(cliente), coop, "cliente"),
  ]);
  assert.equal(a.quantidade, 300);
  assert.equal(b.quantidade, 300);
  const retransmissao = structuredClone(coop);
  await acompanhar(criarPagamentoRecompensa(cliente), retransmissao, "cliente");
  await acompanhar(criarPagamentoRecompensa(host), retransmissao, "host");
  assert.deepEqual(host.chamadas, [[{ product: 85, value: 300 }, `Bearer ${token("conta-do-host")}`]]);
  assert.deepEqual(cliente.chamadas, [[{ product: 85, value: 300 }, `Bearer ${token("conta-do-cliente")}`]]);
  assert.deepEqual(await acompanhar(criarPagamentoRecompensa(host), coop, "outro"), { tipo: "inelegivel" });
});

test("resposta perdida após envio permanece pendente e a reabertura não reenvia", async () => {
  const env = ambiente("conta-solo");
  let envios = 0;
  env.creditar = async () => { envios++; throw new Error("conexão fechada"); };
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await acompanhar(criarPagamentoRecompensa(env), solo, "solo"), { tipo: "pendente" });
  }
  assert.equal(envios, 1);
});

test("um HTTP 201 sem identificador permanece pendente e uma rejeição definitiva exibe falha", async () => {
  const env = ambiente("conta-solo");
  env.creditar = async () => ({ status: 201, data: {} });
  assert.deepEqual(await acompanhar(criarPagamentoRecompensa(env), solo, "solo"), { tipo: "pendente" });
  const rejeitado = ambiente("conta-solo");
  rejeitado.creditar = async () => { throw { response: { status: 401 } }; };
  assert.deepEqual(await acompanhar(criarPagamentoRecompensa(rejeitado), solo, "solo"), { tipo: "falha" });
});

test("o crédito usa os limites inclusivos e o primeiro milissegundo da faixa seguinte", async () => {
  const casos = [
    { tempoMs: 839999, valores: [550, 350] },
    { tempoMs: 840000, valores: [550, 350] },
    { tempoMs: 840001, valores: [500, 300] },
    { tempoMs: 960000, valores: [500, 300] },
    { tempoMs: 960001, valores: [450, 200] },
    { tempoMs: 1080000, valores: [450, 200] },
    { tempoMs: 1080001, valores: [400, 200] },
    { tempoMs: 3600000, valores: [400, 200] },
  ];
  for (const { tempoMs, valores: [soloEsperado, coopEsperado] } of casos) {
    for (const [resultado, jogador, esperado] of [[solo, "solo", soloEsperado], [coop, "host", coopEsperado]]) {
      const env = ambiente("conta");
      const estado = await acompanhar(criarPagamentoRecompensa(env), { ...resultado, tempoMs }, jogador);
      assert.equal(estado.quantidade, esperado, `${jogador} em ${tempoMs} ms`);
      assert.deepEqual(env.chamadas[0][0], { product: 85, value: esperado });
    }
  }
});

test("partida sem hack final confirmado ou com tempo inválido não inicia pagamento", async () => {
  const env = ambiente("conta-solo");
  env.autenticar = () => assert.fail("não deve autenticar sem vitória");
  for (const resultado of [null, { tempoMs: 0 }, { ...solo, tempoMs: -1 }, { ...solo, tempoMs: Infinity }]) {
    assert.deepEqual(await acompanhar(criarPagamentoRecompensa(env), resultado, "solo"), { tipo: "inelegivel" });
  }
  assert.deepEqual(env.chamadas, []);
});
