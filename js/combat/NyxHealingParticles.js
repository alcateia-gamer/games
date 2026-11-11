/** Heal_preview.gif em roxo acompanha o beneficiário enquanto ele está com a cura. */
import { criarEfeitoEspecial, atualizarEfeitoEspecial, deslocamentoChao } from './SpecialAbilityEffects.js';

export function criarParticulasCuraNyx(scene,alvo) {
  const animacao=criarEfeitoEspecial(scene,'nyx-cura',28);
  if (animacao) {
    animacao.sprite.coopAnchor = alvo;
    animacao.sprite.setName?.('nyx-cura-particulas');
    return {alvo,grafico:animacao.sprite,animacao};
  }
  // Implementação anterior preservada para indisponibilidade do recurso.
  const grafico=scene.add.graphics();
  grafico.coopAnchor = alvo;
  if (!grafico.fillRect) { grafico.destroy();return null; }
  grafico.setName?.('nyx-cura-particulas');
  return {alvo,grafico};
}

export function atualizarParticulasCuraNyx(scene,efeito,decorrido) {
  const {alvo,grafico}=efeito;
  if (!alvo?.active || alvo.morto || (Number.isFinite(alvo.vida) && alvo.vida<=0) ||
    (alvo===scene.player && (scene.morteEmAndamento || scene.vida<=0))) {
    grafico.destroy();return false;
  }
  const pe=alvo.y+deslocamentoChao(scene);
  if (efeito.animacao) {
    atualizarEfeitoEspecial(efeito.animacao,alvo.x,pe,decorrido,
      Math.max(51,(alvo.depth ?? scene.player.depth ?? 10)+.2));
    return true;
  }
  const altura=(scene.hitboxDanoPlayer?.height || 46)+6;
  const pulso=Math.max(0,1-(decorrido%1000)/300);
  const cores=[0xa855f7,0xc084fc,0xe9d5ff];
  // A cura emite luz: mantém as faíscas legíveis sobre a sombra ambiente da fábrica.
  grafico.clear().setDepth(Math.max(51,(alvo.depth ?? scene.player.depth ?? 10)+.2));
  // Cinco pares espelhados mantêm quantidade, altura e brilho iguais dos dois lados.
  const centro=Math.round(alvo.x);
  for(let i=0;i<5;i++) {
    const progresso=(decorrido/1200+i/5)%1;
    const distancia=Math.round(10+i%3*4+Math.sin(i*2.4+decorrido*.002)*2);
    const y=Math.round(pe-progresso*altura);
    const alpha=Math.sin(progresso*Math.PI)*(.85+pulso*.15);
    const cor=cores[i%cores.length];
    for(const lado of [-1,1]) {
      const x=centro+lado*distancia;
      grafico.fillStyle(cor,alpha*.14).fillRect(x-5,y-3,10,10)
        .fillStyle(cor,alpha*.3).fillRect(x-1,y+4,2,5)
        .fillStyle(cor,alpha).fillRect(x-2,y,4,4);
      if(i%3===0) grafico.fillRect(x-3,y+1,6,1);
    }
  }
  return true;
}

export function destruirParticulasCuraNyx(cura) {
  for(const efeito of cura.visuais.values()) efeito.grafico.destroy();
  cura.visuais.clear();
}
