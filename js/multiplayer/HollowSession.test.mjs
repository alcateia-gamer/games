import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHollowSession, updateHollowSession, validHollowSession } from './HollowSession.js';
const ids = ['kai-mercer', 'magnus-force', 'aria-kade', 'nyx'];
function fixture(count = 2) {
  const room = { players: ids.slice(0,count).map((character,i) => ({ id: `p${i}`, character })) };
  room.hollow = createHollowSession(room.players, 10000);
  return { room, action: (type, i, now = 11000) => updateHollowSession(room,
    { type: `hollow_${type}`, playerId: `p${i}`, sessionId: room.hollow.id }, now) };
}
for (const count of [2,3,4]) test(`${count} jogadores: barreiras de início e fim, duplicatas e votos`, () => {
  const { room, action } = fixture(count);
  for (let i=0;i<count-1;i++) action('ready',i);
  assert.equal(room.hollow.startAt, null);
  action('ready',count-1);
  assert.equal(room.hollow.startAt,12000);
  assert.equal(action('ready',count-1), false);
  action('skip',0);
  assert.equal(room.hollow.releaseAt,null,'um cliente não libera a fase');
  for (let i=0;i<count-1;i++) action('done',i,20000);
  assert.equal(room.hollow.releaseAt,null);
  action('done',count-1,20000);
  assert.equal(room.hollow.releaseAt,20700);
});
test('votação durante vídeo aguarda todos carregarem; saída reavalia barreira', () => {
  const { room, action } = fixture(3);
  for (let i=0;i<3;i++) action('skip',i);
  assert.equal(room.hollow.skipApproved,true);
  assert.equal(room.hollow.releaseAt,null);
  action('ready',0); action('ready',1);
  room.players.pop();
  assert.equal(updateHollowSession(room,null,15000),true);
  assert.equal(room.hollow.releaseAt,15700);
  assert.deepEqual(room.hollow.cast, ids.slice(0,2));
});
test('ações de outra sessão, remetentes falsificados e fim prematuro são ignorados', () => {
  const { room, action } = fixture();
  assert.equal(action('done',0),false);
  for (const data of [ {sessionId:'antiga',playerId:'p0'}, {sessionId:room.hollow.id,playerId:'estranho'},
    {sessionId:room.hollow.id,playerId:'p0',clientId:'p1'} ])
    assert.equal(updateHollowSession(room,{type:'hollow_skip',...data}),false);
  assert.deepEqual(room.hollow.skipped,[]);
});
// Integração com o roteador real; sem abrir conexão externa nos testes unitários.
globalThis.Phaser = { Events: { EventEmitter } };
const { default: Manager } = await import('./multiplayerManager.js');
class Mqtt extends EventEmitter {
  clientId = 'host';
  connect() {} subscribe() {} unsubscribe() {} disconnect() {}
  publish(topic,data) { this.last = {topic,data}; }
}
test('manager fixa elenco uma vez; comandos só alteram sala no host', () => {
  const manager = new Manager(new Mqtt());
  manager.roomTopic = 'room/TEST';
  manager.room = { roomCode:'TEST',hostId:'host',status:'WAITING',players:[
    manager.normalizePlayer({id:'host',character:ids[0],ready:true}),
    manager.normalizePlayer({id:'client',character:ids[2],ready:true}) ] };
  manager.receiveAction({type:'start_game',playerId:'client'});
  assert.equal(manager.room.status,'WAITING');
  manager.receiveAction({type:'start_game',playerId:'host'});
  const session = manager.room.hollow;
  assert.deepEqual(session.cast,[ids[0],ids[2]]);
  manager.receiveAction({type:'start_game',playerId:'host'});
  assert.equal(manager.room.hollow,session,'eco de início não reinicia transmissão');
  manager.receiveAction({type:'hollow_ready',playerId:'host',sessionId:session.id});
  manager.receiveAction({type:'hollow_ready',playerId:'client',sessionId:session.id});
  assert.ok(session.startAt);
  manager.removePlayer('client');
  manager.receiveAction({type:'hollow_skip',playerId:'host',sessionId:session.id});
  assert.ok(session.releaseAt);
  manager.destroy();
});
test('migração do host preserva o instante em relógios diferentes', () => {
  const manager = new Manager(new Mqtt()); manager.playerId = 'p1';
  const {room} = fixture();
  room.hostId='p0'; room.hollow.startAt=20000;
  manager.room=room; manager.hollowClockOffset=5000;
  manager.removePlayer('p0');
  assert.equal(room.hostId,'p1'); assert.equal(room.hollow.startAt,15000);
  manager.destroy();
});

test('estado compartilhado inválido é recusado antes de acessar o elenco', () => {
  const { room } = fixture();
  assert.equal(validHollowSession(room.hollow), true);
  for (const bad of [null, {}, {...room.hollow, cast:['intruso']}, {...room.hollow, ready:null},
    {...room.hollow, cast:['nyx','nyx']}, {...room.hollow,startAt:Infinity}]) {
    assert.equal(validHollowSession(bad), false);
    assert.equal(updateHollowSession({...room,hollow:bad}), false);
  }
});
