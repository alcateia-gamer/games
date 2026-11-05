/** Colisão física do domo somente com os inimigos; a repulsão não causa dano. */
import { deslocamentoChao } from './SpecialAbilityEffects.js';
import { retanguloLivreDoMapa } from '../enemies/EnemyPathfinding.js';

/** A separação circular do Arcade não resolve bem um retângulo inteiramente interno. */
function expulsarDoInterior(scene, inimigo, circulo) {
  const b = inimigo.body;
  const cx = b.x+b.width/2,cy = b.y+b.height/2;
  const dx = cx-circulo.x,dy = cy-circulo.y,r = circulo.radius;
  if (Math.hypot(dx,dy) >= r) return false;
  const toca = (sx,sy) => {
    const x = Math.max(b.x+sx,Math.min(b.x+sx+b.width,circulo.x));
    const y = Math.max(b.y+sy,Math.min(b.y+sy+b.height,circulo.y));
    return Math.hypot(x-circulo.x,y-circulo.y) < r+.25;
  };
  const angulo = Math.hypot(dx,dy) > .001 ? Math.atan2(dy,dx) : 0;
  for (const giro of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI]) {
    const nx = Math.cos(angulo+giro),ny = Math.sin(angulo+giro);
    let menor = 0,maior = r*2+Math.hypot(b.width,b.height);
    for (let i=0;i<16;i++) {
      const meio = (menor+maior)/2;
      if (toca(nx*meio,ny*meio)) menor = meio; else maior = meio;
    }
    const passos = Math.ceil(maior/4);
    let livre = true;
    for (let i=1;i<=passos;i++) {
      const area = {x:b.x+nx*maior*i/passos,y:b.y+ny*maior*i/passos,width:b.width,height:b.height};
      const mundo = scene.physics.world?.bounds;
      if (!retanguloLivreDoMapa(scene,area) || (b.collideWorldBounds && mundo &&
        (area.x<mundo.left || area.y<mundo.top || area.x+area.width>mundo.right || area.y+area.height>mundo.bottom))) {
        livre = false;break;
      }
    }
    if (!livre) continue;
    b.x += nx*maior;b.y += ny*maior;
    b.updateCenter?.();
    return true;
  }
  return false;
}

export function criarColisaoDomoKai(scene, estado, raio, duracao) {
  if (!scene.physics?.add?.existing || !scene.physics?.add?.collider) return null;
  const objeto = scene.add.circle(scene.player.x,scene.player.y,1,0,0)
    .setVisible(false);
  objeto.setName?.('kai-domo-colisao');
  scene.physics.add.existing(objeto,true);
  objeto.body.enable = false;
  const contatos = new WeakMap();
  let encerrado = false;
  const inimigoValido = inimigo => inimigo?.active && !inimigo.morto &&
    !inimigo.remoteOnly && inimigo.body && inimigo.body.enable !== false;
  const repelir = (inimigo) => {
    const agora = scene.time.now;
    if (!inimigoValido(inimigo) || agora < (contatos.get(inimigo) || 0)) return;
    const body = inimigo.body;
    const dx = body.x+body.width/2-objeto.x;
    const dy = body.y+body.height/2-objeto.y;
    const distancia = Math.hypot(dx,dy);
    const nx = distancia > .001 ? dx/distancia : 1;
    const ny = distancia > .001 ? dy/distancia : 0;
    body.setVelocity(nx*280,ny*280);
    // A IA existente preserva o impulso durante esta breve janela.
    inimigo.especialEmpurraoAte = Math.max(inimigo.especialEmpurraoAte || 0,agora+180);
    inimigo.especialAtordoadoAte = Math.max(inimigo.especialAtordoadoAte || 0,agora+180);
    contatos.set(inimigo,agora+180);
  };
  const collider = scene.physics.add.collider(scene.inimigos || [],objeto,repelir,
    inimigo => {
      if (!objeto.body.enable || !inimigoValido(inimigo)) return false;
      if (expulsarDoInterior(scene,inimigo,objeto)) {
        repelir(inimigo);
        return false; // Já separado, evita uma segunda correção pelo Arcade.
      }
      return true;
    });
  const atualizar = (x = scene.player.x,y = scene.player.y) => {
    if (encerrado) return;
    if (scene.multiplayer || scene.personagemSelecionada !== 'kai-mercer' ||
      !scene.player.active || scene.morteEmAndamento || scene.time.now >= estado.parryAte) {
      destruir();
      return;
    }
    const decorrido = scene.time.now-(estado.parryAte-duracao);
    const abertura = Math.max(0,Math.min(1,decorrido/350));
    const efeito = estado.parryEfeito;
    const limites = efeito?.meta.limitesEfeito;
    const r = limites && efeito ? (limites[2]-limites[0])*efeito.escala/2 : raio;
    // O círculo tem o mesmo diâmetro visível da base do GIF.
    const tamanho = Math.max(1,r*abertura);
    objeto.setPosition(x,y);
    if (objeto.radius !== tamanho) {
      objeto.setRadius(tamanho);
      objeto.body.setCircle(tamanho);
    }
    objeto.body.updateFromGameObject();
    objeto.body.enable = abertura > 0;
    // A lista pode mudar após uma morte ou quando novos robôs aparecem.
    collider.object1 = scene.inimigos || [];
  };
  const antesDaFisica = () => {
    atualizar(scene.player.x,scene.player.y+deslocamentoChao(scene));
  };
  const destruir = () => {
    if (encerrado) return;
    encerrado = true;
    scene.events.off('preupdate',antesDaFisica);
    collider.destroy();
    objeto.destroy();
  };
  scene.events.on('preupdate',antesDaFisica);
  return {atualizar,destruir,get corpo(){return objeto.body;}};
}
