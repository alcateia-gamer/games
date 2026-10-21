/**
 * @file Adaptador MQTT do jogo. Conecta ao broker por WebSocket e converte tópicos e mensagens
 * em eventos internos.
 */

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
    this.client.on("message", (topic, message) => {
      let data;
      try { data = JSON.parse(message.toString()); } catch { data = message.toString(); }
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
    this.client.publish(`${this.topicPrefix}/${topic}`, JSON.stringify(envelope), { qos: options.qos ?? 1, retain: options.retain ?? false });
    return true;
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
  }
}

export default MqttClient;