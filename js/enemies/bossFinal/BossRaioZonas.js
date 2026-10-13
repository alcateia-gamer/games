import { bossDepth, danoAtaqueChao } from "./BossConfig.js";
import { causarDanoJogador } from "./BossCombate.js";

// Ajuste estes limites se o mapa da arena for alterado.
// Três faixas verticais, incluindo a entrada, conforme o desenho de referência.
const ESQUERDA = -1606;
const DIREITA = -600;
const TOPO = -5860;
const BASE = -5470;
const LARGURA = (DIREITA - ESQUERDA) / 3;

// O sprite do raio é sincronizado com os 12 frames do ataque do Boss.
const FRAME_APARECER = 4;
const FRAME_DANO_INICIO = 6;
const FRAME_DANO_FIM = 9;
const FRAME_DESAPARECER = 11;
const CHANCE_SEGUIR_JOGADOR = 0.75;
const TEXTURA = "boss-raio-zona";

function retanguloZona(indice) {
  return new Phaser.Geom.Rectangle(
    ESQUERDA + indice * LARGURA,
    TOPO,
    LARGURA,
    BASE - TOPO,
  );
}

function escolherZona(boss) {
  const player = boss.scene.player;
  let indiceJogador = player?.active
    ? Math.floor((player.x - ESQUERDA) / LARGURA)
    : -1;
  if (indiceJogador < 0 || indiceJogador > 2 || Math.random() >= CHANCE_SEGUIR_JOGADOR) {
    return Phaser.Math.Between(0, 2);
  }
  return indiceJogador;
}

export function iniciarRaioZona(boss) {
  limparRaioZona(boss);
  const indice = escolherZona(boss);
  const area = retanguloZona(indice);
  const ia = boss.iaCombate;
  ia.zonasRaio = [indice + 1];
  ia.areaRaio = area;
  ia.raioZonaIndice = indice;
  ia.raioZonaUltimoFrame = -1;
  ia.jogadorAtingidoRaio = false;

  if (!boss.scene.textures.exists(TEXTURA)) {
    console.warn("RAIO_BOSS.png não foi carregado: efeito de raio indisponível.");
    return;
  }
  const efeito = boss.scene.add.sprite(area.centerX, area.centerY, TEXTURA, 0);
  efeito.setDisplaySize(area.width, area.height);
  efeito.setDepth(bossDepth - 0.5);
  efeito.setVisible(false);
  boss.raioZonaSprite = efeito;
}

export function atualizarRaioZona(boss) {
  const ia = boss.iaCombate;
  if (ia.ataqueAtual !== "raioChao" || !ia.areaRaio) return;
  const frame = ia.frame;
  if (frame === ia.raioZonaUltimoFrame) return;
  ia.raioZonaUltimoFrame = frame;
  const ativo = frame >= FRAME_APARECER && frame < FRAME_DESAPARECER;

  const efeito = boss.raioZonaSprite;
  if (efeito?.active) {
    efeito.setVisible(ativo);
    if (ativo) {
      // Uma única textura de 311x623 por quadro, sem criar efeitos novos.
      const textura = boss.scene.textures.get(TEXTURA);
      const quadros = textura.getFrameNames().filter((nome) => /^\\d+$/.test(String(nome)));
      const total = quadros.length;
      if (total > 0) {
        const progresso = (frame - FRAME_APARECER) / Math.max(1, FRAME_DESAPARECER - FRAME_APARECER - 1);
        const indice = Math.min(total - 1, Math.floor(progresso * total));
        efeito.setFrame(indice);
      }
    }
  }

  if (frame < FRAME_DANO_INICIO || frame > FRAME_DANO_FIM || ia.jogadorAtingidoRaio) return;
  const player = boss.scene.player;
  if (!player?.active) return;
  const hitbox = boss.scene.hitboxDanoPlayer;
  if (!hitbox) return;
  if (Phaser.Geom.Intersects.RectangleToRectangle(hitbox, ia.areaRaio)) {
    ia.jogadorAtingidoRaio = causarDanoJogador(boss, danoAtaqueChao);
  }
}

export function limparRaioZona(boss) {
  if (boss.raioZonaSprite?.active) boss.raioZonaSprite.destroy();
  boss.raioZonaSprite = null;
  if (!boss.iaCombate) return;
  boss.iaCombate.zonasRaio = [];
  boss.iaCombate.areaRaio = null;
  boss.iaCombate.raioZonaIndice = null;
  boss.iaCombate.raioZonaUltimoFrame = -1;
  boss.iaCombate.jogadorAtingidoRaio = false;
}
