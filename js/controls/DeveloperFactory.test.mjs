import test from 'node:test';
import assert from 'node:assert/strict';
import { podeValidarFabricaDev, solicitarValidacaoFabricaDev } from './DeveloperFactory.js';

function fixture() {
  const requests = [];
  const scene = { sys: { settings: { key: 'Level1Parte2' } }, developerMode: true,
    player: { active: true }, vida: 100, generatorMenuOpen: true,
    preparacaoBoss: { aguardando: true, menuAbertoAntesDaEspera: false },
    coopRuntime: { manager: { sendCoopAction(kind) { requests.push(kind); return true; } } } };
  return { scene, requests };
}

test('H pode validar a fábrica durante a espera de carregamento do boss', () => {
  const { scene, requests } = fixture();
  assert.equal(solicitarValidacaoFabricaDev(scene), true);
  assert.deepEqual(requests, ['devFactoryAccess']);
});

test('H conserva bloqueios de menus reais e da introdução', () => {
  for (const patch of [{ preparacaoBoss: null },
    { preparacaoBoss: { aguardando: true, menuAbertoAntesDaEspera: true } },
    { upgradeMenuOpen: true }, { devItemMenuOpen: true }, { cenaEntradaBossAtiva: true },
    { developerMode: false }, { vida: 0 }, { hackingTerminals: { temSessao: () => true } }]) {
    const { scene, requests } = fixture(); Object.assign(scene, patch);
    assert.equal(solicitarValidacaoFabricaDev(scene), false);
    assert.deepEqual(requests, []);
  }
});

test('a espera local não autoriza um menu aberto no contexto remoto', () => {
  const { scene } = fixture();
  assert.equal(podeValidarFabricaDev(scene, { developerMode: true, player: { active: true },
    vida: 100, generatorMenuOpen: true }), false);
});
