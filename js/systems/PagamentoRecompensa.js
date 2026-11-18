import { autenticarRecompensa } from "./IdentidadeRecompensa.js";
import { criarRegistroRecompensas } from "./RegistroRecompensas.js";

const CREDITO_URL = "https://feira-de-jogos.dev.br/api/v2/credit";
const PRODUTO = 85;
const FAIXAS_RECOMPENSA = [
  { limiteMs: 14 * 60000, solo: 550, coop: 350 },
  { limiteMs: 16 * 60000, solo: 500, coop: 300 },
  { limiteMs: 18 * 60000, solo: 450, coop: 200 },
  { limiteMs: Infinity, solo: 400, coop: 200 },
];

function contaDaCredencial(credencial) {
  // O Google sub serve apenas para a reserva local. A Feira autentica o token no crédito.
  const payload = credencial.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const { sub } = JSON.parse(atob(payload));
  if (typeof sub !== "string" || !sub) throw new Error("Credencial sem conta Google");
  return sub;
}

export function criarPagamentoRecompensa({
  autenticar = autenticarRecompensa,
  creditar = (dados, opcoes) => globalThis.axios.post(CREDITO_URL, dados, opcoes),
  registro = criarRegistroRecompensas(),
} = {}) {
  const pagamentos = new Map();

  async function processar(partida, jogador, valor, atualizar) {
    try {
      const anterior = await registro.obter(partida, jogador);
      if (anterior) return atualizar(anterior);
      atualizar({ tipo: "autenticacao" });
      const credencial = await autenticar(renderizar => atualizar({ tipo: "autenticacao", renderizar }));
      const conta = contaDaCredencial(credencial);
      const reserva = await registro.reservar(partida, jogador, conta);
      if (!reserva.reservado) return atualizar(reserva.estado);

      atualizar({ tipo: "processando" });
      let estado = { tipo: "pendente" };
      try {
        const resposta = await creditar({ product: PRODUTO, value: valor }, {
          headers: { Authorization: `Bearer ${credencial}` },
          timeout: 15000,
        });
        const operacao = resposta.data?.operation;
        if (resposta.status === 201 && Number.isSafeInteger(operacao) && operacao > 0) {
          estado = { tipo: "confirmado", quantidade: valor, operacao };
        }
      } catch (erro) {
        // Esses retornos são rejeições documentadas antes da inserção. Uma resposta
        // perdida, um erro de servidor ou 429 não identifica a operação desta partida.
        if ([400, 401, 402, 403].includes(erro?.response?.status)) estado = { tipo: "falha" };
      }
      if (estado.tipo !== "pendente") {
        await registro.salvar(partida, jogador, conta, estado).catch(() => {});
      }
      atualizar(estado);
    } catch {
      atualizar({ tipo: "falha" });
    }
  }

  return {
    iniciar(resultado, jogador, multiplayer) {
      const { tempoMs, recompensa } = resultado ?? {};
      if (!Number.isSafeInteger(tempoMs) || tempoMs < 0 ||
          typeof recompensa?.partida !== "string" || !recompensa.partida ||
          !Array.isArray(recompensa.participantes) || !recompensa.participantes.includes(jogador)) return {
        observar(listener) {
          listener({ tipo: "inelegivel" });
          return () => {};
        },
      };
      const { partida } = recompensa;
      const chave = JSON.stringify([partida, jogador]);
      if (pagamentos.has(chave)) return pagamentos.get(chave);
      const faixa = FAIXAS_RECOMPENSA.find(({ limiteMs }) => tempoMs <= limiteMs);
      const valor = multiplayer ? faixa.coop : faixa.solo;
      let estado = { tipo: "pendente" };
      const listeners = new Set();
      const pagamento = {
        observar(listener) {
          listeners.add(listener);
          listener(estado);
          return () => listeners.delete(listener);
        },
      };
      pagamentos.set(chave, pagamento);
      void processar(partida, jogador, valor, novo => {
        estado = novo;
        for (const listener of listeners) listener(novo);
      });
      return pagamento;
    },
  };
}

export const pagamentoRecompensa = criarPagamentoRecompensa();
