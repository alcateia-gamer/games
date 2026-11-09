/** Agenda de emissões; física, GIF, varredura e defesas vêm do laser existente. */
import { criarLasersEspiral } from "./ataques/LasersEspiral.js";
import { criarServicosAtaques } from "./NovoBossServicosAtaques.js";

export function emissoesPadraoPrologo(tipo, rotacao = 0) {
  const emissoes = [];
  if (tipo === "espiral") {
    for (let i = 0; i < 18; i++) emissoes.push({ em: i * 160, angulo: rotacao + i * 29 });
  } else if (tipo === "aneis") {
    for (let onda = 0; onda < 2; onda++) for (let i = 0; i < 12; i++) {
      // Três posições consecutivas vazias: abertura de 120 graus entre as bordas.
      if (i < 3) continue;
      emissoes.push({ em: onda * 1200, angulo: rotacao + onda * 45 + i * 30 });
    }
  } else {
    for (let onda = 0; onda < 3; onda++) for (const faixa of [-18, 0, 18]) {
      emissoes.push({ em: onda * 550, angulo: rotacao + faixa });
      emissoes.push({ em: onda * 550, angulo: rotacao + 180 + faixa });
    }
  }
  return emissoes;
}

export function criarPadraoPrologo(scene, encontro, tipo, ondaId, indice) {
  const rotacao = tipo === "rajadas" ? (indice % 4) * 45 : (indice * 37) % 360;
  const emissoes = emissoesPadraoPrologo(tipo, rotacao);
  const servicos = criarServicosAtaques(scene, encontro);
  const registrar = servicos.registrarLaser;
  servicos.registrarLaser = visual => {
    visual.prologoEncontroId = encontro.prologo.id;
    visual.prologoOndaId = ondaId;
    registrar(visual);
  };
  const laser = criarLasersEspiral(scene, encontro, {
    ...encontro.config.prologo.lasers, quantidade: emissoes.length, emissoes,
  }, servicos);
  const aviso = scene.add.graphics().setDepth(51).setName("novo-boss-prologo-direcoes");
  let tempo = 0, destruido = false;
  return {
    ...laser, padrao: tipo,
    atualizar(delta) {
      if (destruido) return true;
      tempo += delta;
      aviso.clear();
      if (tempo < encontro.config.prologo.lasers.avisoMs && tipo !== "espiral") {
        const angulos = tipo === "rajadas" ? [rotacao, rotacao + 180] : [rotacao + 30];
        aviso.lineStyle(tipo === "rajadas" ? 10 : 3, tipo === "rajadas" ? 0xff907e : 0x63efb7, 0.35);
        for (const graus of angulos) {
          const angulo = graus * Math.PI / 180;
          aviso.lineBetween(encontro.x, encontro.y, encontro.x + Math.cos(angulo) * 380,
            encontro.y + Math.sin(angulo) * 380);
        }
      }
      return laser.atualizar(delta);
    },
    destruir() { if (!destruido) { destruido = true; laser.destruir(); aviso.destroy(); } },
  };
}
