/** Reprodução por duração de cada quadro, sem timers que sobrevivam à cena. */
const BOSS_AREA = 'PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/area-ataque/';
const DEFINICOES = {
  kai: { arquivo: `${BOSS_AREA}area-ataque-quadros.png`, meta: `${BOSS_AREA}area-ataque.json`, w:221, h:157, origem:[110/221,84/157], diametro:190 },
  nyx: { arquivo:'efeitos/especiais/nyx.png', meta:'efeitos/especiais/nyx.json', w:384, h:192, origem:[189/384,126/192], diametro:240 },
  'nyx-cura': { arquivo:'efeitos/especiais/nyx-cura.png', meta:'efeitos/especiais/nyx-cura.json', w:192, h:192, origem:[88.5/192,189/192], diametro:177 },
  magnus: { arquivo:'efeitos/especiais/magnus (1).png', meta:'efeitos/especiais/magnus.json', w:496, h:506, origem:[.5,340/506], diametro:345 },
};

export function carregarEfeitosEspeciais(scene) {
  scene.load.image('magnus-especial-marreta',
    'PERSONAGENS/PERSONAGENS PRICIPAIS/MAGNUS_FORCE 2/magnus_martelo.png');
  for (const [nome,d] of Object.entries(DEFINICOES)) {
    scene.load.spritesheet(`especial-${nome}`, d.arquivo, {frameWidth:d.w, frameHeight:d.h});
    scene.load.json(`especial-${nome}-meta`, d.meta);
  }
}

export function criarEfeitoEspecial(scene, nome, raio) {
  const d = DEFINICOES[nome], chave = `especial-${nome}`;
  if (!scene.textures?.exists?.(chave)) return null;
  const meta = scene.cache.json.get(`${chave}-meta`);
  if (!meta) return null;
  const sprite = scene.add.image(0,0,chave,0).setOrigin(...d.origem);
  sprite.setScale(raio*2/d.diametro);
  if (nome === 'kai') sprite.setTint(0x38bdf8).setTintMode(Phaser.TintModes.FILL);
  return {sprite, meta, escala:sprite.scaleX, nome, total:meta.duracoesMs.reduce((a,b)=>a+b,0)};
}

/** A hitbox de dano termina nos pés; evita ancorar efeitos de chão no tronco. */
const ANCORA_CHAO = new WeakMap();
export function deslocamentoChao(scene) {
  if (!scene.player) return 0;
  if (!ANCORA_CHAO.has(scene.player)) {
    ANCORA_CHAO.set(scene.player, Number.isFinite(scene.hitboxDanoPlayer?.bottom)
      ? scene.hitboxDanoPlayer.bottom-scene.player.y : 0);
  }
  return ANCORA_CHAO.get(scene.player);
}

export function atualizarEfeitoEspecial(efeito, x, y, decorrido, depth, progresso = null) {
  if (!efeito) return;
  let tempo = (efeito.nome === 'nyx' || efeito.nome === 'magnus') ? Math.min(efeito.total-.001,Math.max(0,decorrido))
    : progresso === null ? decorrido % efeito.total : Math.min(.99999, progresso)*efeito.total;
  let indice = 0;
  while (indice < efeito.meta.duracoesMs.length-1 && tempo >= efeito.meta.duracoesMs[indice]) {
    tempo -= efeito.meta.duracoesMs[indice++];
  }
  efeito.sprite.setPosition(x,y).setDepth(depth).setFrame(indice);
  if (efeito.nome === 'kai') {
    const abertura = Math.min(1, decorrido/350);
    efeito.sprite.setScale(efeito.escala*abertura);
  }
}

/** Calota transparente: mesma base do GIF, arco acima do corpo e raios na superfície. */
export function desenharDomoKai(g, efeito, x, y, raio, decorrido, depth) {
  const abertura = Math.min(1,decorrido/350);
  const limites = efeito?.meta.limitesEfeito;
  const rx = limites && efeito ? (limites[2]-limites[0])*efeito.escala*abertura/2 : raio*abertura;
  const ry = limites && efeito ? (limites[3]-limites[1])*efeito.escala*abertura/2 : rx*.65;
  const altura = rx*1.15;
  g.setDepth(depth+.15).clear();
  const ponto = (angulo, vertical, extra = 0) => ({
    x:x+Math.cos(angulo)*(rx+extra),
    y:y+Math.sin(angulo)*(vertical+extra),
  });
  const arco = (inicio,fim,vertical,cor,alpha,preencher=false) => {
    let anterior = ponto(inicio,vertical);
    for(let i=1;i<=32;i++) {
      const atual = ponto(inicio+(fim-inicio)*i/32,vertical);
      if(preencher) g.fillStyle(0x38bdf8,.045).fillTriangle(x,y,anterior.x,anterior.y,atual.x,atual.y);
      g.lineStyle(1.5,cor,alpha).lineBetween(anterior.x,anterior.y,atual.x,atual.y);
      anterior = atual;
    }
  };
  // A borda traseira da base e o arco superior dão volume à cúpula.
  arco(Math.PI,Math.PI*2,ry,0x38bdf8,.18);
  arco(Math.PI,Math.PI*2,altura,0x8de7ff,.75,true);
  arco(0,Math.PI,ry,0x75dfff,.6,true);
  // Dois reflexos curtos acompanham a curvatura, sem uma bolha menor no tronco.
  for(const lado of [-1,1]) {
    let anterior = null;
    for(let i=0;i<=12;i++) {
      const a = Math.PI*1.12+i*Math.PI*.30/12;
      const atual = {x:x+lado*Math.abs(Math.cos(a))*rx*.86,y:y+Math.sin(a)*altura*.93};
      if(anterior) g.lineStyle(1,0xbbefff,.22).lineBetween(anterior.x,anterior.y,atual.x,atual.y);
      anterior = atual;
    }
  }
  const instante = Math.floor(decorrido/75);
  for(let i=0;i<10;i++) {
    if((instante+i)%4===0) continue;
    const superior = i<7;
    const base = superior ? Math.PI+(i+.3)*Math.PI/7 : (i-6.5)*Math.PI/3;
    const vertical = superior ? altura : ry;
    let anterior = null;
    for(let j=0;j<5;j++) {
      const angulo = base+(j-2)*.035+Math.sin(instante*.7+i)*.04;
      const atual = ponto(angulo,vertical,(j%2 ? 3 : -2)*abertura);
      if(anterior) {
        g.lineStyle(4,0x38bdf8,.16).lineBetween(anterior.x,anterior.y,atual.x,atual.y);
        g.lineStyle(1.5,j%2 ? 0xbff4ff : 0x38bdf8,.95)
          .lineBetween(anterior.x,anterior.y,atual.x,atual.y);
      }
      anterior = atual;
    }
  }
}

/** Folha original: caminhada 64px no alto; marreta 9×4 de 128px a partir de y=258. */
export function iniciarAnimacaoMarreta(scene) {
  const chave = 'magnus-especial-marreta';
  if (!scene.textures?.exists?.(chave) || !scene.anims || !scene.player?.anims) return;
  const textura = scene.textures.get(chave);
  const direcoes = ['up','left','down','right'];
  for (let linha=0;linha<4;linha++) {
    const frames = [];
    for (let coluna=0;coluna<9;coluna++) {
      const nome = `${direcoes[linha]}-${coluna}`;
      if (!textura.has(nome)) textura.add(nome,0,coluna*128,258+linha*128,128,128);
      frames.push({key:chave,frame:nome});
    }
    const key = `attack-marreta-${direcoes[linha]}`;
    if (!scene.anims.exists(key)) scene.anims.create({key,frames,frameRate:20,repeat:0});
  }
  const player = scene.player, body = player.body;
  const antes = {x:player.displayOriginX,y:player.displayOriginY};
  const offset = body ? {x:body.offset.x,y:body.offset.y} : null;
  const direcao = direcoes.includes(scene.direcaoAtual) ? scene.direcaoAtual : 'down';
  scene.atacando = true;
  scene.direcaoAtaque = direcao;
  player.setTexture(chave,`${direcao}-0`).setDisplayOrigin(58,77);
  // A folha tem outra origem. Compensa o corpo físico sem trocar sua área de colisão.
  if (offset) body.setOffset(offset.x+58-antes.x,offset.y+77-antes.y);
  player.anims.timeScale = 1;
  player.anims.play(`attack-marreta-${direcao}`,true);
  // O final de attack-* já restaura caminhada, origem e corpo em Player.js.
}
