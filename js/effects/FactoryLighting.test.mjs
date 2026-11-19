import test from 'node:test';import assert from 'node:assert/strict';
import FactoryLighting,{intensidadeLuzPartida,QUEDAS_LUZ_FABRICA,luzAfetaCamera} from './FactoryLighting.js';
test('controlador de energia não consulta o mapa nem armazena luminárias',()=>{
 const l=new FactoryLighting({getObjectLayer(){throw Error('não deve ler');}});
 assert.equal('lampadas' in l,false);assert.equal('estados' in l,false);
 l.definirEnergia(true);assert.equal(l.energia,true);l.definirEnergia(false);assert.equal(l.energia,false);
});
test('partida conserva perfil sonoro, relógio compartilhado e fallback de tempo',()=>{
 const l=new FactoryLighting();let p=.3;l.definirEnergia(true,()=>p,0);
 assert.equal(l.atualizarPartida(10),.3);p=1;l.atualizarPartida(20);assert.equal(l.partida,null);
 l.definirEnergia(true,()=>null,0);assert.ok(l.atualizarPartida(100)>0);
 assert.equal(intensidadeLuzPartida(0),0);assert.equal(intensidadeLuzPartida(1),1);assert.ok(QUEDAS_LUZ_FABRICA.length>0);
});
test('fontes dinâmicas do boss continuam usando a geometria da câmera',()=>{
 const c={width:800,height:450,matrix:{a:1,b:0,c:0,d:1,e:0,f:0}};
 assert.equal(luzAfetaCamera({x:100,y:100,raio:50},c),true);
 assert.equal(luzAfetaCamera({x:5000,y:5000,raio:50},c),false);
});
