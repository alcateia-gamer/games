/**
 * @file Adaptador MQTT do jogo. Conecta ao broker por WebSocket e converte tópicos e mensagens
 * em eventos internos.
 */

import { encodeFrame, decodeFrame } from "./multiplayer/CoopCompression.js";
import { mergePendingFrame } from "./multiplayer/CoopVisuals.js";

const CLIENT_ID_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Gera o identificador aleatório de oito caracteres usado por este cliente MQTT.
 */
function generateClientId() {
  let id = "";
  for (let index = 0; index < 8; index += 1) {
    id += CLIENT_ID_LETTERS[Math.floor(Math.random() * CLIENT_ID_LETTERS.length)];
  }
  return id;
}

class MqttClient extends Phaser.Events.EventEmitter {
  /**
   * Guarda conexão, prefixo dos tópicos, intervalo de reconexão e assinaturas desejadas.
   */
  constructor({ brokerUrl, topicPrefix = "nullborns", reconnectPeriod = 2000 } = {}) {
    super();
    this.brokerUrl = brokerUrl;
    this.topicPrefix = topicPrefix.replace(/\/$/, "");
    this.reconnectPeriod = reconnectPeriod;
    this.clientId = generateClientId();
    this.client = null;
    this.connected = false;
    this.subscriptions = new Set();
    this.pendingFrame = null;
    this.encodingFrame = false;
    this.networkStats = { messages: 0, rawBytes: 0, sentBytes: 0 };
  }

  /**
   * Abre a conexão e conecta os eventos do MQTT aos eventos do jogo, restaurando assinaturas
   * após reconexões.
   */
  connect() {
    if (this.client || typeof mqtt === "undefined") {
      if (typeof mqtt === "undefined") this.emit("error", new Error("MQTT não carregado"));
      return;
    }
    this.client = mqtt.connect(this.brokerUrl, {
      clientId: this.clientId,
      reconnectPeriod: this.reconnectPeriod,
      connectTimeout: 8000,
      clean: true,
    });
    this.client.on("connect", () => {
      this.connected = true;
      this.emit("connect");
      this.subscriptions.forEach((topic) => this.subscribe(topic));
    });
    this.client.on("reconnect", () => this.emit("reconnecting"));
    this.client.on("offline", () => { this.connected = false; this.emit("close"); });
    this.client.on("close", () => { this.connected = false; this.emit("close"); });
    this.client.on("error", (error) => this.emit("error", error));
    this.client.on("message", async (topic, message) => {
      let data;
      try {
        const decoded = message[0] === 0x1f && message[1] === 0x8b
          ? await decodeFrame(message) : message.toString();
        data = JSON.parse(decoded);
      } catch { return; }
      const prefix = `${this.topicPrefix}/`;
      const shortTopic = topic.startsWith(prefix) ? topic.slice(prefix.length) : topic;
      this.emit("message", shortTopic, data);
      this.emit(`message:${shortTopic}`, data);
    });
  }

  /**
   * Registra uma assinatura e a envia ao broker quando a conexão está disponível.
   */
  subscribe(topic) {
    this.subscriptions.add(topic);
    if (!this.client || !this.connected) return;
    this.client.subscribe(`${this.topicPrefix}/${topic}`, { qos: 1 }, (error) => {
      if (error) this.emit("error", error);
    });
  }

  /**
   * Remove uma assinatura local e cancela sua inscrição no broker se estiver conectado.
   */
  unsubscribe(topic) {
    this.subscriptions.delete(topic);
    if (this.client && this.connected) this.client.unsubscribe(`${this.topicPrefix}/${topic}`);
  }

  /**
   * Serializa a mensagem com o ID do remetente e publica com QoS e retenção configuráveis;
   * retorna false sem conexão.
   */
  publish(topic, data, options = {}) {
    if (!this.client || !this.connected) return false;
    const envelope = typeof data === "object" && data !== null ? { ...data, clientId: this.clientId } : { data, clientId: this.clientId };
    const json = JSON.stringify(envelope), fullTopic = `${this.topicPrefix}/${topic}`;
    const publishOptions = { qos: options.qos ?? 1, retain: options.retain ?? false };
    if (options.compress && topic.endsWith("/frame")) {
      // Uma codificação em andamento e apenas o quadro seguinte: nunca acumula atraso.
      const merged = mergePendingFrame(this.pendingFrame?.data, envelope);
      this.pendingFrame = { data: merged, json: JSON.stringify(merged), topic: fullTopic, options: publishOptions };
      void this.flushFrame();
    } else {
      this.client.publish(fullTopic, json, publishOptions);
      this.recordNetwork(json.length, json.length);
    }
    return true;
  }

  recordNetwork(raw, sent) {
    this.networkStats.messages++; this.networkStats.rawBytes += raw; this.networkStats.sentBytes += sent;
  }

  async flushFrame() {
    if (this.encodingFrame) return;
    this.encodingFrame = true;
    try {
      while (this.pendingFrame && this.connected && this.client) {
        const frame = this.pendingFrame, client = this.client; this.pendingFrame = null;
        const bytes = await encodeFrame(frame.json);
        if (this.client === client && this.connected) {
          client.publish(frame.topic, bytes, frame.options);
          this.recordNetwork(frame.json.length, bytes.byteLength);
        }
      }
    } catch (error) { this.emit("error", error); }
    finally { this.encodingFrame = false; }
  }

  /**
   * Encerra a conexão e limpa o estado e as assinaturas deste cliente.
   */
  disconnect() {
    if (!this.client) return;
    this.client.end(true);
    this.client = null;
    this.connected = false;
    this.subscriptions.clear();
    this.pendingFrame = null;
  }
}

export default MqttClient;
