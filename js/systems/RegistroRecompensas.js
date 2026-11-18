/** Reserva o pagamento antes do envio, com unicidade por partida e conta no navegador. */
export function criarRegistroRecompensas(indexedDB = globalThis.indexedDB) {
  let abertura;
  function abrir() {
    return abertura ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("nullborns-recompensas", 1);
      request.onupgradeneeded = () => {
        const pagamentos = request.result.createObjectStore("pagamentos", { keyPath: ["partida", "jogador"] });
        pagamentos.createIndex("conta", ["partida", "conta"], { unique: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function transacao(modo, operar) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("pagamentos", modo);
      let resposta;
      tx.oncomplete = () => resolve(resposta);
      tx.onabort = () => reject(tx.error);
      operar(tx.objectStore("pagamentos"), valor => { resposta = valor; });
    });
  }
  return {
    obter(partida, jogador) {
      return transacao("readonly", (loja, concluir) => {
        const consulta = loja.get([partida, jogador]);
        consulta.onsuccess = () => concluir(consulta.result?.estado);
      });
    },
    reservar(partida, jogador, conta) {
      return transacao("readwrite", (loja, concluir) => {
        const porJogador = loja.get([partida, jogador]);
        porJogador.onsuccess = () => {
          if (porJogador.result) return concluir({ estado: porJogador.result.estado });
          const porConta = loja.index("conta").get([partida, conta]);
          porConta.onsuccess = () => {
            if (porConta.result) return concluir({ estado: porConta.result.estado });
            loja.add({ partida, jogador, conta, estado: { tipo: "pendente" } });
            concluir({ reservado: true });
          };
        };
      });
    },
    salvar(partida, jogador, conta, estado) {
      return transacao("readwrite", loja => loja.put({ partida, jogador, conta, estado }));
    },
  };
}
