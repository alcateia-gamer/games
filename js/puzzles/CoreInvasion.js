import { MemoryDecryption } from './MemoryDecryption.js';
import { HostConnection } from './HostConnection.js';
import { normalizarCheckpoint } from './HackingProgress.js';
import { deltaHacking } from './HackingMotion.js';
/** Memory Decryption → conexão numérica → transmissão existente. */
export class CoreInvasion {
  constructor(config, checkpoint = {}, salvar = () => {}, tentativa = 1) {
    this.config = config; this.salvar = salvar; this.checkpoint = normalizarCheckpoint(checkpoint); this.transicao = 0;
    this.model = this.checkpoint.memoryModules === 3 ? new HostConnection(config, this.checkpoint.hostConnected)
      : new MemoryDecryption(config, this.checkpoint.memoryModules, tentativa);
    this.estado = 'ativo';
  }
  persistir() {
    const next = { ...this.checkpoint };
    if (this.model instanceof MemoryDecryption) next.memoryModules = this.model.recuperados;
    if (this.model instanceof HostConnection && this.model.passo === 1) next.hostConnected = true;
    if (next.memoryModules !== this.checkpoint.memoryModules || next.hostConnected !== this.checkpoint.hostConnected) {
      this.checkpoint = next; this.salvar({ ...next });
    }
  }
  acao(op, valor) { const accepted = this.model.acao(op, valor); if (accepted) this.persistir(); return accepted; }
  atualizar(delta) {
    this.model.atualizar(delta); this.persistir();
    if (this.model instanceof MemoryDecryption && this.model.estado === 'sucesso') {
      this.transicao += deltaHacking(delta);
      if (this.transicao >= 900) this.model = new HostConnection(this.config);
    }
    if (this.model instanceof HostConnection && this.model.estado === 'sucesso') this.estado = 'sucesso';
  }
  snapshot() {
    const view = this.model.snapshot(), transitando = this.model instanceof MemoryDecryption && this.model.estado === 'sucesso';
    return { ...view, tipo: 'matrix', etapaTipo: view.tipo, estado: transitando ? 'transicao' : view.estado,
      ...(transitando ? { transicao: Math.min(1, this.transicao / 900), mensagem: view.mensagem + '\nINITIALIZING HOST CONNECTION...\nN.O.V.A.: as proteções foram neutralizadas. Encontrei o endereço do núcleo. Precisamos estabelecer a conexão.' } : {}) };
  }
}
