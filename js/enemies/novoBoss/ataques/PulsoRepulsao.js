/** Ataque ofensivo independente da barreira e de seus geradores. */
export const pulsoRepulsaoPadrao = Object.freeze({
  raio: 145,
  avisoMs: 900,
  expansaoMs: 250,
  dano: 14,
  empurrao: 230,
  duracaoEmpurrao: 180,
});

export function criarPulsoRepulsao(scene, encontro, config = {}, servicos = {}) {
  const entrada = config?.ataques?.pulsoRepulsao ?? config ?? {};
  const opcoes = { ...pulsoRepulsaoPadrao, ...entrada };
  for (const chave of ["raio", "avisoMs", "expansaoMs"]) {
    if (!Number.isFinite(opcoes[chave]) || opcoes[chave] <= 0) opcoes[chave] = pulsoRepulsaoPadrao[chave];
  }
  // A onda nasce no ponto anunciado, mesmo se a entidade for reposicionada.
  const origem = { x: encontro.sprite?.x ?? encontro.x, y: encontro.sprite?.y ?? encontro.y };
  const duracao = opcoes.avisoMs + opcoes.expansaoMs;
  let aviso = servicos.criarAviso?.(origem.x, origem.y, opcoes.raio, opcoes.avisoMs) ?? null;
  let grafico = null;
  let tempo = 0;
  let destruido = false;
  let tentouAcertar = false;
  let atingiu = false;
  let explosaoCriada = false;
  const raioNoTempo = valor => valor < opcoes.avisoMs ? 0 : opcoes.raio;

  return {
    tipo: "pulsoRepulsao",
    duracao,
    atualizar(delta) {
      if (destruido) return true;
      tempo += Number.isFinite(delta) ? Math.max(0, delta) : 0;
      aviso?.atualizar(Math.min(1, tempo / opcoes.avisoMs));
      if (tempo >= opcoes.avisoMs) {
        aviso?.destruir();
        aviso = null;
        if (!explosaoCriada) {
          explosaoCriada = true;
          servicos.somExplosaoPulso?.(origem, tempo - opcoes.avisoMs);
          servicos.criarExplosaoPulso?.(origem, opcoes.raio, tempo - opcoes.avisoMs,
            Number.isFinite(delta) ? Math.max(0, delta) : 0);
        }
        if (!grafico && scene.add?.graphics) {
          grafico = scene.add.graphics();
          grafico.setDepth(52);
        }
        const raioAtual = raioNoTempo(tempo);
        if (grafico) {
          grafico.clear();
          const progresso = Math.min(1, (tempo - opcoes.avisoMs) / opcoes.expansaoMs);
          grafico.lineStyle(5, 0xff5544, (1 - progresso) * 0.8);
          grafico.strokeCircle(origem.x, origem.y, raioAtual);
          grafico.lineStyle(2, 0xffddd0, (1 - progresso) * 0.9);
          grafico.strokeCircle(origem.x, origem.y, Math.max(0, raioAtual - 6));
        }
        // No fim do aviso, toda a área anunciada é resolvida de uma vez.
        // A cauda da explosão não adia o acerto nem atinge quem entrar depois.
        if (!tentouAcertar) {
          tentouAcertar = true;
          if (servicos.jogadorAtingeCirculo?.(origem.x, origem.y, opcoes.raio)) {
            // O serviço conserva esquiva/invulnerabilidade e condiciona o empurrão ao dano.
            atingiu = Boolean(servicos.danoJogador?.(opcoes.dano, origem, {
              empurrao: opcoes.empurrao,
              duracaoEmpurrao: opcoes.duracaoEmpurrao,
            }));
          }
        }
      }
      if (tempo >= duracao) this.destruir();
      return destruido;
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      aviso?.destruir();
      aviso = null;
      grafico?.destroy();
      grafico = null;
    },
    snapshot() {
      return { tipo: "pulsoRepulsao", tempo, duracao, destruido, origem: { ...origem },
        raio: raioNoTempo(tempo), impactoEm: opcoes.avisoMs, atingiu, tentouAcertar };
    },
  };
}
