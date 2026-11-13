# Cibernéticas, armamento e sucata — NULLBORNS

Implementação integrada às duas cenas existentes. Não acrescenta aplicação, biblioteca, servidor ou persistência permanente.

## Uso

O comerciante está no **Mapa 1, x = -410, y = 8817**, no interior da loja já acessível pelo teleporte da cidade em `(816, -860)`. O teleporte leva a `(-436, 8940)`; caminhe em direção ao comerciante. O alcance de interação é 90 pixels, medido entre os centros dos sprites. Use E ou o botão de interação existente (ícone de mão), que aparece ao entrar no alcance. Não há aviso de texto sobre o NPC. E, Esc ou FECHAR encerram o terminal.

O NPC usa exclusivamente `assets/PERSONAGENS/NPC/NPC.png`, recurso que já estava no diretório de trabalho. A imagem tem 1152 × 3968 pixels, em células de 64 × 64: frame 180, linha 10 e coluna 0, pose frontal da caminhada LPC. Permanece parado, sem corpo físico, ataque, hitbox de dano ou participação no grupo de inimigos. Assim não bloqueia a circulação na loja. As coordenadas são de mundo, iguais às coordenadas do mapa infinito do Tiled: não se soma origem de chunk nem se multiplica por tamanho do tile.

O terminal exibe personagem local, saldo, categorias, níveis, regiões corporais, sprite original ampliado e prévia dos atributos. Compras sem saldo, no máximo ou em andamento ficam desabilitadas. O layout usa três colunas com rolagem interna; em telas estreitas passa a uma coluna. Textos são DOM nativo, como os HUDs existentes, mantendo nitidez nas resoluções solicitadas. A renderização do menu ocorre por eventos, sem reconstrução a cada frame.

## Melhorias e preços finais

Preços por instalação, em sucatas. Os valores de cada nível são **totais acumulados**, e não parcelas somadas aos níveis anteriores.

| Módulo | Níveis 1 / 2 / 3 | Preços 1 / 2 / 3 |
|---|---|---|
| Reforço muscular | +5 / 10 / 15% dano corpo a corpo | 8 / 14 / 22 |
| Regulador biossintético | +5 / 10 / 15% vida máxima | 8 / 14 / 22 |
| Atuadores neurais | +3 / 6 / 9% caminhada | 9 / 15 / 23 |
| Processador de combate | −5 / 10 / 15% recarga especial | 10 / 17 / 25 |
| Blindagem subdérmica | −3 / 6 / 9% dano recebido | 10 / 17 / 25 |
| Kai: Sistema de combate | +6 / 12 / 18% dano da arma | 10 / 18 / 28 |
| Kai: Reflexo neural | −2 / 4 / 6 pontos percentuais de recarga; +4 / 8 / 12% dano refletido | 10 / 17 / 25 |
| Magnus: Marreta Atlas | +6 / 12 / 18% dano da marreta | 10 / 18 / 28 |
| Magnus: Impacto sísmico | +5 / 10 / 15% dano da onda | 10 / 17 / 25 |
| Aria: Arco de precisão | +6 / 12 / 18% dano das flechas | 10 / 18 / 28 |
| Aria: Projeção fantasma | +5 / 10 / 15% duração do holograma | 10 / 17 / 25 |
| Nyx: Núcleo de restauração | +6 / 12 / 18% cura por pulso | 10 / 18 / 28 |
| Nyx: Estabilizador neural | −3 / 6 / 9 pontos percentuais de recarga | 10 / 17 / 25 |

Aria continua utilizando **arco e flecha**, incluindo carga e projéteis originais. Como não tem ataque corpo a corpo, Reforço muscular é incompatível com ela e não é vendido ao selecioná-la. Nyx melhora sua aura, sem substituir sua arma ou criar uma cura nova.

## Fórmulas e limites

Regras centrais em `UpgradeSystem.js`, definições em `UpgradeDefinitions.js` e parâmetros de recompensa em `UpgradeBalance.js`.

- Dano corpo a corpo: `dano original × (1 + bônus muscular + bônus da arma)`. Não há multiplicação dos bônus entre si: teto de +33% para Kai e Magnus.
- Flecha: `dano original da carga × (1 + bônus do arco)`. Metadados de rede conservam o dano anterior ao bônus para o host não aplicá-lo duas vezes.
- Vida máxima: `vida original × (1 + bônus de vida)`. Na instalação, `vida atual nova = proporção anterior × novo máximo`. Reaplicar o mesmo nível não cura.
- Caminhada: `velocidade base × (1 + bônus motor)`. O valor base de 200 px/s não é sobrescrito; teto normal de 218 px/s. Dash e turbo conservam suas regras originais.
- Dano recebido: `dano do acerto × (1 − blindagem)`, aplicado uma vez em `tomarDano`.
- Recarga: `recarga original × (1 − processador − recuperação específica)`, com piso de 6800 ms para Kai e 3000 ms para os demais. Kai mantém ao menos 1 segundo sem o domo de 5800 ms; Reflexo ainda aumenta o dano refletido quando a recarga já está no piso.
- Magnus: multiplica o dano por distância da onda por até 1,15, com o arredondamento inteiro existente. Não amplia raio, duração ou empurrão.
- Aria: um holograma dura até 5175 ms, em vez de 4500 ms. Mantém uma cópia e o teleporte existente.
- Nyx: cada pulso cura até 5,9% da vida máxima do beneficiário, por dez pulsos. Nunca revive mortos ou supera a vida máxima. Recarga mínima resultante dos módulos atuais: 15,2 segundos.

As vidas originais são Kai 100, Magnus 115, Aria 85 e Nyx 95. O ataque básico continua usando o balanceamento próprio de cada personagem. O boss solo mantém os 1000 PV e os padrões de combate existentes.

## Sucata e economia

| Robô | Chance | Unidades por componente | Valor esperado por morte elegível |
|---|---|---|---|
| Padrão | 75% | 1–3 | 1,50 |
| Serra | 90% | 2–4 | 2,70 |
| Bola | 75% | 1–3 | 1,50 |
| Olhão, se associado a uma zona natural | 100% | 4–7 | 5,50 |

Boss, clones, torres e spawns de atalhos não pagam sucata. O Olhão atualmente não tem zona natural de recompensa na campanha.

Cada morte elegível pode gerar **um componente com várias unidades** na posição do inimigo. Usa as 12 variações de `assets/COLETAVEIS/sucatas.png`, com recorte das margens e pulsação discreta de alpha. A aparência de cada drop é estável entre clientes; o contador usa o ícone do meio da última linha. Não há um corpo por unidade. Aproximar-se a 46 pixels solicita a coleta; o host tolera até 62 pixels para a posição recebida. A coleta remove o registro antes de creditar o saldo, mostra `+N SUCATAS` e atualiza o contador permanente.

A cidade possui sete zonas do Tiled, com grupos de três a cinco robôs e ambos os tipos padrão/serra garantidos quando há espaço. Um grupo de quatro, com distribuição média de dois de cada tipo, rende aproximadamente **8,4 sucatas**. Três a quatro grupos completos rendem aproximadamente **25,2–33,6**: permitem duas a quatro instalações iniciais, conforme escolhas. Isso é estimativa estática, não medição de uma partida. A loja é alcançável por teleporte antes de eliminar todas as zonas; uma visita antecipada pode ter saldo menor. Não há crédito fictício ou exigência de limpar o mapa inteiro.

A fábrica possui 18 áreas de robôs-bola, com ondas proporcionais à área e um limite regional compartilhado já existente. O retorno à cidade após ligar o gerador continua bloqueado pela progressão original; portanto compras devem ser planejadas antes desse ponto. A fábrica continua concedendo sucata, preservada na partida, sem criar outra loja ou modificar o encerramento do jogo.

Proteção contra coleta infinita:

- Cada objeto de inimigo passa uma vez pelo sorteio de recompensa, inclusive quando o sorteio não gera sucata.
- Orçamento persistente de cinco mortes elegíveis por zona da cidade e sete por área da fábrica, independente de revisitas/respawns.
- Limite global de 96 mortes elegíveis por partida e 48 componentes pendentes no conjunto dos mapas. Ao exceder o limite de componentes, o registro mais antigo é removido.
- Componentes fora da cena atual conservam apenas dados; imagens e tweens são destruídos ao sair.

## Multiplayer e persistência

O projeto usa MQTT e **host autoritativo**, sem servidor dedicado de combate. A implementação reutiliza `sendCoopAction`, sua deduplicação e os keyframes do `CoopRuntime`.

Cada jogador possui um saldo, e seus níveis ficam organizados por identificador de personagem. O cliente envia somente o ID do componente ou o ID/nível esperado da compra. O host valida personagem do contexto, vida, mapa, proximidade, saldo, preço e nível máximo; ignora saldo/preço declarados pelo cliente. O nível esperado também bloqueia retransmissões de compra. Componentes são compartilhados e exclusivos: quem coleta primeiro recebe as unidades, uma única vez. Em equipes, a moeda de uma mesma zona é dividida entre os coletores, sem multiplicação pelo número de participantes.

O host calcula dano básico, vida máxima e habilidades usando os níveis registrados para o jogador correto. A normalização de rede reconhece vida ampliada sem aceitar `maxHealth` arbitrário enviado pelo cliente. A blindagem entra no fluxo de dano local existente uma única vez, inclusive ao receber a ação autoritativa `hurt`.

Alterações econômicas são enviadas por eventos QoS 1; keyframes periódicos recuperam estado perdido. Quadros intermediários não carregam a economia inteira. Compressão/agrupamento preserva a economia do keyframe; revisões antigas de estado de sala não substituem saldos novos. O progresso fica no registry no solo e no estado da sala no cooperativo, preservando mudanças de fase. Nova incursão iniciada por `BootPartida` limpa essa economia. Não se usa localStorage nem save permanente; atributos derivados são recalculados.

Limites da arquitetura original: posições e parte dos vitais continuam informados pelos clientes; o broker não constitui autenticação forte nem um servidor antitrapaça. A validação econômica usa a posição conhecida pelo host. A migração de host conserva o último estado econômico recebido, mas a reconstrução dos inimigos já tinha limitações no código original. Não se reescreveu esse netcode.

## Arquivos criados

- `js/systems/UpgradeDefinitions.js`: catálogo e compatibilidade por personagem.
- `js/systems/UpgradeBalance.js`: posição, alcance, probabilidades e limites.
- `js/systems/UpgradeSystem.js`: contas, compras atômicas, modificadores, cache e atributos derivados.
- `js/systems/ScrapSystem.js`: morte, recompensa, coleta, contador, replicação e limpeza.
- `js/interactions/UpgradeNPC.js`: comerciante e integração com E e o botão de interação existente.
- `js/ui/UpgradeShopUI.js`: terminal, navegação, prévias, bloqueio/restauração de input e feedback.
- `js/systems/Upgrades.test.mjs`: testes automatizados de regras e integração com mocks dos serviços Phaser/DOM/rede.
- `docs/ciberneticas-e-economia.md`: esta entrega técnica.

## Arquivos modificados

- Cenas/carregamento: `js/scenes/BootPartida.js`, `preloader.js`, `Level1.js`, `Level1Parte2.js`.
- Jogador: `js/player/Player.js`, `PlayerProjectiles.js`, `PlayerStatus.js`.
- Combate: `js/combat/PlayerSpecialAbilities.js`, `NyxHealingAura.js`.
- Inimigos: `js/enemies/EnemyHealth.js`, `EnemySpawnManager.js`.
- Rede: `js/multiplayer/CoopRuntime.js`, `CoopPlayers.js`, `CoopVisuals.js`, `multiplayerManager.js`.
- Bloqueio de input no terminal: `js/controls/AriaAttackJoystick.js`, `DeveloperItemMenu.js`, `DeveloperTeleport.js`, `DeveloperTeleportButtons.js`, `PlayerAttackControls.js`, `PlayerInput.js`, `PlayerJoystick.js`, `PlayerSpecialControls.js`; movimento real em `PlayerMovement.js`.
- Inventário: `js/inventory/ItemPickup.js`, para impedir interações simultâneas com o modal.
- Aparência: `style.css`.

A remoção do antigo `character-spritesheet (1).png` e a presença de `NPC.png` já existiam no workspace antes da implementação e foram preservadas.

## Verificação e pendências

Não foi iniciado o jogo, servidor de desenvolvimento ou navegador. Node.js 22.16.0 foi disponibilizado apenas em `/tmp` para executar os testes, pois o ambiente não tinha `node` no PATH. Não foram instaladas dependências no projeto.

Comando específico: `node js/systems/Upgrades.test.mjs`.

Os testes cobrem compras atômicas, saldo insuficiente, limite de níveis, reenvio de compra, quatro personagens, vida proporcional sem reaplicação cumulativa, blindagem real, flecha real, holograma real, aura real da Nyx, onda real do Magnus no boss, movimento real, probabilidades determinísticas, coleta concorrente, limite de drops, limpeza, transição de estado, coordenada/frame do NPC, proximidade, abertura/fechamento/restauração de input, soltura de E, listeners, normalização de vida na rede e troca de ações host/cliente.

A responsividade e o recurso de sprite foram verificados estaticamente. A usabilidade visual nas quatro resoluções e a execução em um broker com dois dispositivos **não foram testadas**. Esses são os passos de validação manual pendentes; a simulação automatizada de ações não substitui uma sessão real de multiplayer. As estimativas de duração/economia também precisam de playtest para medir a rota escolhida pelo jogador.

As falhas preexistentes da suíte geral foram reproduzidas em uma cópia dos módulos originais de `HEAD`, fora do workspace, sem aplicar as alterações desta tarefa:

- `js/effects/FactoryLighting.test.mjs`: 5 falhas.
- `js/map/ColisoesMapa.test.mjs`: 4 falhas.
- `js/player/colisoes/PlayerCollisionConfig.test.mjs`: 2 falhas.
- `js/sounds/interacoesSerra.test.mjs`: 1 falha por recurso de áudio não encontrado.

Os totais finais executados são registrados abaixo após concluir a verificação.

Resultado final:

- **26/26 testes novos passaram**, executando diretamente `Upgrades.test.mjs`.
- **118 arquivos de teste, 1193 testes: 1181 passaram e 12 falharam**, nos quatro arquivos preexistentes acima. Cada arquivo foi executado diretamente com Node e os totais TAP foram agregados.
- **338 arquivos JS/MJS passaram** em `node --check` (bibliotecas vendorizadas excluídas).
- **226 imports relativos** dos módulos alterados/criados foram verificados, sem destinos ausentes.
- `git diff --check` passou.
