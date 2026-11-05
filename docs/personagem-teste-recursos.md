> **Pacote revertido a pedido do usuário.** Regeneração, armas e interface voltaram
> ao comportamento anterior. Este documento registra a implementação histórica;
> os itens não são concedidos, carregados nem exibidos no jogo.
> Imagens originais, derivados e módulos ficaram preservados, sem integração ativa.

# Vida, stamina e consumíveis do personagem teste

Aplicado às duas opções de teste existentes (`personagem-teste` e
`personagem-teste-2`). Os personagens originais mantêm regeneração, custos,
controles e HUD anteriores.

## Comportamento

- [x] 100 de vida e 100 de stamina máximos, com valores atuais/máximos nas barras.
- [x] Sem regeneração automática de vida ou stamina nos protótipos. O DEV também
  não repõe sua stamina nem ignora custos; o atalho antigo dos originais permanece.
- [x] Corpo a corpo custa 1 por golpe: espada, florete branco e arma dourada.
  Disparo do rifle custa 3. Cadência, dano e alcance foram preservados.
- [x] Golpes recusados não consomem energia; fila de combo só cobra quando a
  próxima etapa começa. Saldo insuficiente impede o ataque.
- [x] O losango azul do botão de troca mostra o custo da arma equipada.
- [x] Toxina de cura recupera 20% da vida máxima; comprimidos de desempenho
  recuperam 30% da stamina máxima, limitados ao máximo de cada barra.
- [x] Um de cada item no início. Estoques pertencem ao inventário real e os
  presentes iniciais não são concedidos novamente ao trocar/reiniciar cenas.
- [x] Itens não são consumidos com recurso cheio, estoque vazio, jogador morto
  ou menu aberto. Cliques nos itens não iniciam ataques.
- [x] DEV ao lado esquerdo do minimapa; itens no antigo espaço do DEV, um abaixo
  do outro, com quantidade e percentual. Os dois atalhos substituem sua exibição
  duplicada na faixa inferior do inventário do protótipo.
- [x] Trocar de sala conserva vida e energia restantes. Respawn continua
  restaurando os recursos conforme o fluxo existente de uma nova vida.

## Arquivos desta mudança

| Arquivos | Motivo |
| --- | --- |
| `js/player/RecursosPersonagemTeste.js` (novo) | Regras, presentes iniciais, consumo e preservação dos recursos entre cenas. |
| `js/player/PlayerStatus.js` | Regeneração restrita aos originais e números nas barras dos testes. |
| `js/player/PersonagemTeste.js` | Regra compartilhada de custo por categoria de arma. |
| `js/player/ArmaPersonagemTeste.js` | Cobrar uma vez quando cada disparo/golpe começa, incluindo combos. |
| `js/controls/PlayerTestActionControls.js` | Número no centro medido do losango azul do botão. |
| `js/controls/PlayerInput.js` | Reposicionar DEV e controles auxiliares apenas nos protótipos. |
| `js/controls/PlayerRecoveryControls.js` (novo) | Botões dos dois itens, percentuais, quantidades, cliques e compensação do zoom. |
| `js/inventory/InventoryItems.js` | Cadastrar os itens com suas imagens transparentes. |
| `js/inventory/ItemPickup.js` | Criar atalhos após o inventário estar disponível. |
| `js/inventory/InventoryUI.js` | Evitar duplicação visual dos dois consumíveis nos protótipos. |

Testes atualizados: `ArmaPersonagemTeste.test.mjs`,
`PlayerTestActionControls.test.mjs` e `DeveloperItemMenu.test.mjs` (paginação
compatível com os novos itens). Novos: `RecursosPersonagemTeste.test.mjs` e
`tests/personagem-teste-recursos.browser.mjs`.

## Imagens

Os PNGs originais `toxina-de-cura.png` e `comprimidos-de-desempenho.png` não foram
sobrescritos. Cópias preparadas com a ferramenta integrada `image_gen.imagegen`:

- `assets/PERSONAGENS/personagens-teste/derivados/recuperacao/toxina-de-cura-transparente.png`
- `assets/PERSONAGENS/personagens-teste/derivados/recuperacao/comprimidos-de-desempenho-transparente.png`

Prompts completos, dimensões e hashes das fontes e saídas constam em
`assets/PERSONAGENS/personagens-teste/derivados/recuperacao/processamento.json`.
Os prompts pedem a remoção apenas do fundo externo, com preservação do roxo,
cinza e realces da seringa, assim como do verde, contorno preto, tampa e rótulo
claros dos comprimidos. As novas imagens têm resolução própria; o sistema
existente prepara seus ícones proporcionais no tamanho de exibição.

## Validação

- [x] Os 39 arquivos de testes selecionados passaram: jogador, controles,
  inventário, combate e novo boss.
- [x] Casos de saldo insuficiente, custo de todas as armas, combo sem dupla
  cobrança, ausência de regeneração, cura proporcional, estoque e persistência.
- [x] No Chromium, cliques reais nos itens e nas quatro armas validaram
  recuperação, custos 1/1/3/1, contadores, ausência de desperdício, indicador
  da arma e bloqueio sem stamina.
- [x] No navegador, reiniciar a cena manteve barras e estoques; Kai conservou a
  regeneração e a HUD anteriores. Sem erros JavaScript, assets ou console.
- [x] Transparência verificada nos pixels dos PNGs carregados: cantos com alfa
  zero, regiões transparentes e interiores brancos/coloridos preservados.
- [x] Composição inspecionada em `/tmp/personagem-teste-recursos/hud.png`.

Nenhum arquivo foi excluído ou renomeado. As alterações anteriores do boss e
os arquivos enviados pelo usuário foram preservados.

## Reversão do pacote

- [x] Restabelecidas a regeneração automática e as regras anteriores das armas.
- [x] Restabelecidas as barras sem numeração extra, o botão de troca sem custo
  sobreposto e a posição anterior do DEV.
- [x] Retirados o cadastro, a concessão inicial e os botões dos consumíveis.
  Estoques desses dois itens deixados pela versão anterior são removidos antes
  de desenhar o inventário, preservando os demais itens e o histórico de coleta.
- [x] Nove arquivos de código e testes foram conferidos como idênticos à versão
  anterior ao pacote; a única adaptação do inventário é a migração acima.
- [x] Os 41 arquivos Node selecionados passaram. No Chromium foram confirmados
  regeneração, ataque sem os novos custos, dash custando 25, interface anterior,
  migração dos estoques e reinício sem erros JavaScript, assets ou console.
- [x] Nenhum arquivo do boss ou do dash foi alterado nesta reversão.

`RecursosPersonagemTeste.js`, `PlayerRecoveryControls.js`, imagens originais e
cópias transparentes permanecem arquivados, sem chamadas ou carregamento pelo
jogo. Os dois roteiros de testes do pacote agora verificam a reversão.
