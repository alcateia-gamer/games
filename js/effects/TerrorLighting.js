import FactoryLighting, { ESCURIDAO_AMBIENTE_FABRICA, MULTIPLICADOR_ALCANCE_FABRICA, QUEDAS_LUZ_FABRICA } from './FactoryLighting.js';
import { criarSomLuzFabrica } from '../sounds/luzFabrica.js';
import { atualizarPoseLanterna, atualizarLanternasAliadas } from './FlashlightPose.js';
import FlashlightWalls from './FlashlightWalls.js';
import { ocultarLanternaAtrasCamada, ocultarLanternaAtrasSala, obterRegiaoFrenteLanterna } from './FlashlightTileOcclusion.js';
import { ocultarBrilhoAtrasSprite as ocultarBrilhoAtrasPersonagem } from './SpriteLightOcclusion.js';
import DoorLightingZones from './DoorLightingZones.js';
import BossRoomLighting from './BossRoomLighting.js';
import BossEnergyLighting, { calcularPerfilEnergiaBoss, calcularPerfilAuraBoss } from './BossEnergyLighting.js';
import BossAuraLightCache from './BossAuraLightCache.js';
import BossEnergyLightBuffer from './BossEnergyLightBuffer.js';
import { criarTexturaIluminacao } from './LightingTexture.js';
import { alphaOscilacaoFabrica } from './FactoryAmbientOscillation.js';
import { depthAcimaTorres } from './EffectDepth.js';
import { lanternaDesativada, desativarLanternaDefinitivamente } from './FlashlightLifecycle.js';
export { intensidadeLuzPartida, QUEDAS_LUZ_FABRICA } from './FactoryLighting.js';
const TAMANHO_MASCARA = 256;
const ESCURIDAO_MINIMA_FABRICA = 0.2;
const TEXTURA_ESCURIDAO_PARTE2 = 'level1-parte2-escuridao';
function suavizar(valor) {
  const p = Math.max(0, Math.min(1, valor));
  return p * p * p * (p * (6 * p - 15) + 10);
}


function criarMascaraLuminaria(perfil, cor = 0xFFFFFF) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TAMANHO_MASCARA;
  const context = canvas.getContext("2d");
  const image = context.createImageData(canvas.width, canvas.height);
  const red = (cor >> 16) & 255;
  const green = (cor >> 8) & 255;
  const blue = cor & 255;
  for (let i = 0; i < perfil.length; i++) {
    image.data[i * 4] = red;
    image.data[i * 4 + 1] = green;
    image.data[i * 4 + 2] = blue;
    image.data[i * 4 + 3] = perfil[i];
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function criarMascaraLanterna() {
  const perfil = new Uint8Array(TAMANHO_MASCARA ** 2);
  for (let y = 0; y < TAMANHO_MASCARA; y++) {
    for (let x = 0; x < TAMANHO_MASCARA; x++) {
      const px = (x + 0.5) / TAMANHO_MASCARA * 460 - 100;
      const py = (y + 0.5) / TAMANHO_MASCARA * 320 - 160;
      const distancia = Math.hypot(px, py);
      const cone = px > 0 ? (1 - suavizar(Math.abs(Math.atan2(py, px)) / 0.55)) *
        suavizar(distancia / 8) * (1 - suavizar(distancia / 350)) : 0;
      // O halo termina antes da borda da textura, evitando o recorte reto atrás do jogador.
      const halo = 0.4 * Math.exp(-0.5 * (distancia / 28) ** 2) * (1 - suavizar(distancia / 90));
      perfil[y * TAMANHO_MASCARA + x] = Math.round(Math.max(cone, halo) * 255);
    }
  }
  return criarMascaraLuminaria(perfil);
}

function criarPerfilParede(calcular) {
  const perfil = new Uint8Array(TAMANHO_MASCARA ** 2);
  for (let y = 0; y < TAMANHO_MASCARA; y++) {
    for (let x = 0; x < TAMANHO_MASCARA; x++) {
      perfil[y * TAMANHO_MASCARA + x] = Math.round(calcular(
        (x + 0.5) / TAMANHO_MASCARA * 2 - 1, (y + 0.5) / TAMANHO_MASCARA * 2 - 1) * 255);
    }
  }
  return perfil;
}


function ocultarLanterna(context, lanterna, scene, pose, atrasPlayer, regiao, player = scene.player) {
  const camera = scene.cameras.main;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, 460, 320);
  context.drawImage(lanterna, 0, 0, 460, 320);

  // Mundo -> coordenadas da textura da lanterna, antes da transformação do sprite.
  const cos = Math.cos(pose.angulo), sin = Math.sin(pose.angulo);
  context.setTransform(cos, -sin, sin, cos,
    100 - cos * pose.x - sin * pose.y, 160 + sin * pose.x - cos * pose.y);
  ocultarLanternaAtrasCamada(context, scene.camadaParedeAcimaPerso, camera);
  ocultarLanternaAtrasSala(context, scene, camera, regiao);
  if (atrasPlayer) ocultarBrilhoAtrasPersonagem(context, player);
}

function desenharLuminaria(context, canvas, luz, limites) {
  context.save();
  if (luz.area) {
    const cos = Math.cos(luz.rotacao), sin = Math.sin(luz.rotacao);
    limites?.recortarFonte(context, luz, Math.hypot(luz.largura, luz.altura),
      luz.x + cos * luz.largura / 2 - sin * luz.altura / 2,
      luz.y + sin * luz.largura / 2 + cos * luz.altura / 2);
    context.transform(cos, sin, -sin, cos, luz.x, luz.y);
    context.drawImage(canvas, 0, 0, luz.largura, luz.altura);
    context.restore();
    return;
  }
  limites?.recortarFonte(context, luz, luz.raio * MULTIPLICADOR_ALCANCE_FABRICA);
  if (luz.orientacao === "vertical") context.transform(0, 1, -1, 0, luz.x, luz.y);
  else context.translate(luz.x, luz.y);
  const alcance = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
  context.drawImage(canvas, -alcance, -alcance, alcance * 2, alcance * 2);
  context.restore();
}

/** Um compositor para ambiente, zonas e efeitos de combate; nenhuma fonte fixa do Tiled. */
export default function criarIluminacaoTerror(scene) {
  const camera = scene.cameras.main, renderer = scene.game.renderer;
  const renderEvent = Phaser.Renderer.Events.RENDER;
  scene.recursosLanterna = scene.lanternasAliadas = null;
  const iluminacao = scene.iluminacaoFabrica = new FactoryLighting();
  const zonas = scene.zonasLuzApagada = new DoorLightingZones(scene.map);
  const sala = new BossRoomLighting(scene.map);
  const energiaBoss = scene.iluminacaoEnergiaBoss = new BossEnergyLighting(scene);
  const som = criarSomLuzFabrica(scene, QUEDAS_LUZ_FABRICA, { consecutivas: true });
  let width = Math.ceil(camera.width), height = Math.ceil(camera.height), anterior = null, encerrada = false;
  const texture = criarTexturaIluminacao(scene.textures, TEXTURA_ESCURIDAO_PARTE2, width, height);
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const context = texture.getContext();
  const overlay = scene.add.image(0, 0, TEXTURA_ESCURIDAO_PARTE2).setOrigin(0).setScrollFactor(0).setDepth(50);
  const mascarasPortas = zonas.zonas.map(z => scene.add.rectangle(z.x,z.y,z.largura,z.altura,0x000000)
    .setOrigin(0).setRotation(Math.atan2(z.sin,z.cos)).setDepth(50.001));
  let uniforme=false;
  let aposentada = lanternaDesativada(scene), lanterna = null, boss = null;
  const liberarLanterna = () => {
    aposentada = true;
    if (lanterna) {
      lanterna.paredes.destroy();
      lanterna.canvas.width = lanterna.canvas.height = 0;
      lanterna.oclusao.width = lanterna.oclusao.height = 0;
      lanterna.aliadas.clear(); lanterna = null;
    }
    scene.lanternasAliadas = null;
    scene.recursosLanterna = null;
    anterior = null;
  };
  scene.descarregarLanterna = liberarLanterna;
  if (aposentada) desativarLanternaDefinitivamente(scene);
  if (!aposentada) {
    const oclusao = document.createElement('canvas'); oclusao.width = 460; oclusao.height = 320;
    lanterna = scene.recursosLanterna = { canvas: criarMascaraLanterna(), oclusao,
      context: oclusao.getContext('2d'), paredes: new FlashlightWalls(scene), pose: {}, aliadas: new Map() };
    scene.lanternasAliadas = lanterna.aliadas;
  }
  const iniciarBoss = () => {
    if (boss) return;
    const paredes = new FlashlightWalls(scene);
    const perfis = [false, true, false].map((escudo, i) => {
      const perfil = criarPerfilParede((x,y) => calcularPerfilEnergiaBoss(x,y,escudo));
      return { mascara: criarMascaraLuminaria(perfil), cor: criarMascaraLuminaria(perfil, i === 2 ? 0x40A8FF : 0x289DFF) };
    });
    const aura = new BossAuraLightCache(criarMascaraLuminaria(criarPerfilParede(calcularPerfilAuraBoss)));
    const obter = f => f.vermelha ? aura.obter(f) : perfis[f.choqueTorre ? 2 : Number(f.escudo)];
    const buffer = new BossEnergyLightBuffer((c,f,colorido) => desenharLuminaria(c, colorido ? obter(f).cor : obter(f).mascara, f.luz, paredes));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    boss = { paredes, perfis, aura, obter, buffer, canvas, context: canvas.getContext('2d') };
  };
  let inicializada=false;
  const definir = (ligada, progresso = null) => {
    if (inicializada && iluminacao.energia === (ligada === true)) return;
    if (ligada && inicializada && typeof progresso !== "function") progresso=()=>null;
    inicializada=true;
    if (ligada && !aposentada) desativarLanternaDefinitivamente(scene);
    som.stop(); iluminacao.definirEnergia(ligada, progresso, scene.time.now); anterior = null;
  };
  scene.definirIluminacaoFabrica = definir;
  definir(scene.luzFabricaAcesa === true);
  const registry = scene.game.registry;
  const progresso = (_registry, key, value) => {
    if (key === 'factoryGeneratorPowered' && value === true && !aposentada) desativarLanternaDefinitivamente(scene);
  };
  registry?.events?.on('setdata', progresso); registry?.events?.on('changedata', progresso);
  const transformar = c => { const m = camera.matrix; c.setTransform(m.a,m.b,m.c,m.d,m.e,m.f); };
  const pintarLanterna = (player, pose, frame, regiao) => {
    const l = lanterna, atras = !!frame;
    const recorte = atras || scene.camadaParedeAcimaPerso || regiao;
    if (recorte) ocultarLanterna(l.context, l.canvas, scene, pose, atras, regiao, player);
    context.save(); context.globalAlpha = 1;
    l.paredes.recortar(context, pose.x, pose.y, regiao);
    const cos = Math.cos(pose.angulo), sin = Math.sin(pose.angulo);
    context.transform(cos,sin,-sin,cos,pose.x,pose.y);
    context.drawImage(recorte ? l.oclusao : l.canvas,-100,-160,460,320); context.restore();
  };
  const atualizar = (cena, cam) => {
    if (encerrada || cena !== scene || cam !== camera) return;
    const w = Math.ceil(camera.width), h = Math.ceil(camera.height);
    if (w !== width || h !== height) {
      width=w; height=h; texture.setSize(w,h); overlay.setTexture(TEXTURA_ESCURIDAO_PARTE2); anterior=null; uniforme=false;
      if (boss) { boss.canvas.width=w; boss.canvas.height=h; }
    }
    const m=camera.matrix, e=m.e+m.a*camera.scrollX+m.c*camera.scrollY, f=m.f+m.b*camera.scrollX+m.d*camera.scrollY;
    const det=m.a*m.d-m.b*m.c, sx=Math.hypot(m.d,m.b)/det;
    overlay.setPosition((m.c*f-m.d*e)/det,(m.b*e-m.a*f)/det).setRotation(Math.atan2(-m.b,m.d)).setScale(sx,1/(det*sx));
    overlay.setDepth(depthAcimaTorres(scene,50));
    iluminacao.atualizarPartida(scene.time.now);
    if (iluminacao.progressoPartida !== null) som.update(iluminacao.progressoPartida);
    zonas.atualizar(scene.time.now, scene.portasFabrica ?? [], iluminacao.energia);
    const intro=scene.novoBoss?.introducao?.iluminacao ?? scene.iluminacaoEntradaBossReplica;
    const visivel=sala.visivel(camera);
    const fontes=visivel ? energiaBoss.atualizar(camera) : null;
    if (fontes?.length) { iniciarBoss(); boss.paredes.atualizarPortas(); boss.aura.sincronizar(fontes); }
    const alpha=iluminacao.energia ? alphaOscilacaoFabrica(iluminacao.progressoPartida ?? 1, iluminacao.progressoPartida !== null) : ESCURIDAO_AMBIENTE_FABRICA;
    let poseKey='';
    if (lanterna) {
      lanterna.paredes.atualizarPortas();
      atualizarLanternasAliadas(scene,lanterna.aliadas);
      if (scene.player?.active) atualizarPoseLanterna(scene,lanterna.pose);
      const p=lanterna.pose, ator=scene.player;
      poseKey=`${p.x},${p.y},${p.angulo},${Math.sin(p.angulo)<-.001?ator?.frame?.name:''},${ator?.flipX},${ator?.flipY},${ator?.scaleX},${ator?.scaleY},${ator?.rotation},${ator?.alpha},${ator?.visible},${ator?.texture?.key},${ator?.displayOriginX},${ator?.displayOriginY},${lanterna.paredes.revisao}`;
      for (const e of lanterna.aliadas.values()) poseKey+=`:${e.pose.x},${e.pose.y},${e.pose.angulo},${e.frame?.name},${e.player.scaleX},${e.player.scaleY},${e.player.flipX},${e.player.flipY},${e.player.alpha},${e.player.rotation}`;
    }
    let atoresKey='';
    const atores = fontes?.length ? [scene.player,scene.companionPet,...(scene.inimigos ?? []),
      ...(scene.remotePlayers?.values() ?? []),scene.novoBoss?.sprite,
      ...(scene.novoBoss?.alvosIlusorios ?? []).map(a=>a.sprite)] : null;
    if (atores) for (const a of atores) if (a) atoresKey+=`${a.x},${a.y},${a.alpha},${a.active},${a.visible},${a.displayOriginX},${a.displayOriginY},${a.texture?.key},${a.flipX},${a.flipY},${a.scaleX},${a.scaleY},${a.rotation},${a.frame?.name},${a.frame?.cutX},${a.frame?.cutY}:`;
    const depth=depthAcimaTorres(scene,50);
    for (let i=0;i<mascarasPortas.length;i++) mascarasPortas[i].setDepth(depth+.001).setAlpha(zonas.zonas[i].opacidade);
    if (aposentada && !visivel) {
      if (!uniforme) {
        context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='source-over';
        context.fillStyle='#000000';context.fillRect(0,0,width,height);texture.refresh();uniforme=true;
      }
      overlay.setAlpha(alpha);return;
    }
    if (uniforme) { uniforme=false;anterior=null; }
    overlay.setAlpha(1);
    const chave=`${width},${height},${m.a},${m.b},${m.c},${m.d},${m.e},${m.f},${alpha},${zonas.revisao},${intro?.revisao},${energiaBoss.revisao},${poseKey},${atoresKey}`;
    if (anterior === chave) return;
    anterior=chave;
    context.setTransform(1,0,0,1,0,0); context.globalAlpha=1; context.globalCompositeOperation='source-over';
    context.clearRect(0,0,width,height); context.fillStyle=`rgba(0,0,0,${alpha})`; context.fillRect(0,0,width,height);
    context.save(); transformar(context);
    if (visivel && alpha < ESCURIDAO_AMBIENTE_FABRICA) {
      context.globalAlpha=(ESCURIDAO_AMBIENTE_FABRICA-alpha)/(1-alpha);
      context.drawImage(sala.canvas,sala.x,sala.y);context.globalAlpha=1;
    }
    context.globalCompositeOperation='destination-out';
    if (visivel) sala.desenhar(context,camera,intro?.ambiente ?? 1);
    if (fontes?.length) {
      boss.buffer.preparar(fontes,camera,width,height);
      context.save();context.setTransform(1,0,0,1,0,0);boss.buffer.desenhar(context,false,width,height);context.restore();
    }
    if (lanterna) {
      const l=lanterna, player=scene.player;
      l.paredes.atualizarPortas(); atualizarLanternasAliadas(scene,l.aliadas);
      if (player?.active && !scene.morteEmAndamento) {
        atualizarPoseLanterna(scene,l.pose);
        pintarLanterna(player,l.pose,Math.sin(l.pose.angulo)<-.001 && player.frame?.source?.image ? player.frame : null,obterRegiaoFrenteLanterna(scene,player));
      }
      for (const entrada of l.aliadas.values()) pintarLanterna(entrada.player,entrada.pose,entrada.frame,obterRegiaoFrenteLanterna(scene,entrada.player));
    }
    context.restore();
    if (fontes?.length) {
      const c=boss.context;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,width,height);c.globalCompositeOperation='source-over';
      boss.buffer.desenhar(c,true,width,height);c.save();transformar(c);
      for (const ator of atores) {
        if (ator?.active && ator.frame?.source?.image) ocultarBrilhoAtrasPersonagem(c,ator);
      }
      c.restore();context.save();context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='source-over';context.drawImage(boss.canvas,0,0);context.restore();
      context.save();transformar(context);
      for (const fonte of fontes) if (fonte.vermelha) ocultarBrilhoAtrasPersonagem(context,fonte.emissor,fonte.emissor.x,fonte.emissor.y,.55);
      context.restore();
    }
    texture.refresh();
  };
  context.fillStyle=`rgba(0,0,0,${ESCURIDAO_AMBIENTE_FABRICA})`;context.fillRect(0,0,width,height);texture.refresh();
  const limpar = () => {
    if (encerrada) return; encerrada=true;
    renderer.off(renderEvent,atualizar); scene.events.off('shutdown',limpar);
    registry?.events?.off('setdata',progresso);registry?.events?.off('changedata',progresso);
    liberarLanterna();som.destroy();iluminacao.destroy();zonas.destroy();sala.destroy();energiaBoss.destroy();
    if (boss) {
      boss.paredes.destroy();boss.aura.destroy();boss.buffer.destroy();boss.canvas.width=boss.canvas.height=0;
      for (const p of boss.perfis) p.mascara.width=p.mascara.height=p.cor.width=p.cor.height=0;
    }
    for (const mascara of mascarasPortas) mascara.destroy();
    overlay.destroy();scene.textures.remove(TEXTURA_ESCURIDAO_PARTE2);
    scene.definirIluminacaoFabrica=null;scene.descarregarLanterna=null;
    scene.iluminacaoFabrica=scene.zonasLuzApagada=scene.iluminacaoEnergiaBoss=null;
  };
  renderer.on(renderEvent,atualizar);scene.events.once('shutdown',limpar);
  return limpar;
}
export { ESCURIDAO_MINIMA_FABRICA };
