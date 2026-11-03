# Botões, morte e teleporte da nova boss

As três artes de botão estão integradas nas duas personagens de teste. A pose
de morte e as duas sequências de transformação estão integradas à boss solo.

## Botões

| Arquivo original | Uso | Tamanho na tela |
| --- | --- | --- |
| `personagens-teste/Attack_Button.webp` | Ataque, substituindo círculo/espada anteriores | 92 × 92 px |
| `personagens-teste/Action_Button.webp` | Acionar/interagir, substituindo a mão | 92 × 92 px |
| `personagens-teste/Weapon_Button.webp` | Trocar arma, mantendo a miniatura equipada | 60 px de largura; proporção preservada |

Ataque e interação continuam alternando no mesmo local. Coleta, portas, geradores,
cadência, armas e atalhos mantêm seus controles. Os demais personagens usam a
interface anterior. `Extra_Button.webp` não foi usado nem modificado.

## Morte

`boss-death.webp` contém **uma única pose RGBA de 216 × 216**, sem quadros de
animação ou duração embutida. A cópia `boss-morte.png` conserva exatamente seus
pixels. A apresentação para a animação anterior, troca para essa pose, mantém
a direção, a escala de 0,55 e alinha o capuz ao idle. Segura 600 ms e desvanece
por 300 ms. O corpo permanece desativado e o HUD registra a vitória normalmente.
Não foram inventados quadros intermediários de morte.

## Teleporte: fontes e método

- `teleporte(base).gif`: 400 × 400, 26 quadros, loop; fundo azul sólido
  `(148, 194, 226)`. Anéis cinzas/pretos e feixe branco; o personagem parte do
  centro X=106 e reaparece em X=282.
- O GIF tem pausas de 1000 ms nas duas pontas e três quadros com duração zero.
  Os tempos originais completos ficam em `manifesto.json`.
- `boss-test-idle.png`: grade 4 × 4 de células 288 × 288. A referência é o
  primeiro quadro completo: mantém silhueta, proporções, detalhes e alfa.
- O recorte remove o fundo apenas da referência. A região ocupada pelo
  personagem central também é excluída, inclusive suas silhuetas pretas; não
  remove cores escuras da boss. A chegada usa seu próprio centro de energia.
- Os anéis recebem escala inteira 3× por nearest neighbor e são reposicionados
  para envolver a boss. O feixe é reposicionado acima do corpo, com largura 3×
  e altura nativa. O GIF inteiro não foi esticado.
- Cada pixel original do corpo mantém posição e alfa durante a conversão
  gradual para uma paleta ciano/azul-claro/branco baseada em sua luminosidade.
  Depois, blocos estáveis de 3×3 se desprendem e sobem até desaparecer.
  A chegada reconstrói a silhueta em conjunto com os quadros originais de chegada.
  Não é uma simples sobreposição fixa nem a inversão integral do GIF.
- O canvas transparente passa a **512 × 640**, com pivô `(256,344)`, para
  comportar a energia. A arte original do corpo continua com 288 × 288 pixels;
  não há interpolação, suavização ou alteração de proporções.

## Entregáveis

Tudo fica em
`assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/derivados/teleporte/`:

| Arquivo/pasta | Conteúdo |
| --- | --- |
| `teleporte-saida.gif` | 18 quadros transparentes, 700 ms |
| `teleporte-entrada.gif` | 9 quadros transparentes, 270 ms |
| `teleporte-saida.png` | Spritesheet RGBA, quatro colunas, 2048 × 3200 |
| `teleporte-entrada.png` | Spritesheet RGBA, quatro colunas, 2048 × 1920 |
| `saida/quadro-000.png` a `quadro-017.png` | Quadros individuais de saída, 512 × 640 |
| `entrada/quadro-000.png` a `quadro-008.png` | Quadros individuais de chegada, 512 × 640 |
| `boss-morte.png` | Cópia sem perdas da pose WebP |
| `manifesto.json` | Durações, resolução, pivô, método e SHA-256 das fontes |
| `previa-transformacao.png` | Quadros representativos inspecionados antes da exportação |
| `previa.html` | Reprodução animada, pausa, seleção de quadros e fundos de avaliação |

O PNG RGBA é a versão principal usada no jogo. O GIF compatível tem alfa binário
e paleta de até 255 cores por quadro; não substitui o PNG para preservar os pixels.

**Tempos:** saída usa os quadros-fonte 0–16 e um quadro transparente extra;
chegada usa 17–25 em sua ordem original. As pausas de 1000 ms viram 60/80 ms
para não travar o efeito; durações zero viram 20 ms. No jogo, os pesos dessas
durações são ajustados às janelas existentes de **250 ms de saída + 250 ms de
chegada**. Isso conserva o combate rápido, a invulnerabilidade e as verificações
de destino atuais. Os arquivos exportados mantêm o ritmo útil mais lento da referência.

## Arquivos de código e documentação alterados

- `js/player/PersonagemTeste.js`: configura e carrega os três botões.
- `js/controls/PlayerAttackControls.js`: nova arte somente para personagens de
  teste; tamanho visual e pressão compensam o zoom. Implementação anterior preservada.
- `js/inventory/ItemPickup.js`: arte de acionar e 92 px para as personagens de teste.
- `js/enemies/novoBoss/NovoBossAssets.js`: recursos de morte, saída e chegada.
- `js/enemies/novoBoss/NovoBossApresentacao.js`: pose de morte, transição e
  coordenação do novo visual de teleporte; fallback anterior preservado.
- `js/enemies/novoBoss/NovoBossTeleporteVisual.js` (novo): amostragem por progresso,
  espelhamento, pivô, ocultação do corpo durante o efeito e limpeza. Sem física própria.
- `scripts/preparar-teleporte-boss.py` (novo): prévia, exportação e verificação reproduzíveis.
- Testes atualizados: `js/controls/PlayerTestActionControls.test.mjs`,
  `js/player/ArmaPersonagemTeste.test.mjs`, `js/enemies/novoBoss/NovoBoss.test.mjs`,
  `js/enemies/novoBoss/NovoBossApresentacao.test.mjs`.
- Testes novos: `js/enemies/novoBoss/NovoBossTeleporteVisual.test.mjs` e
  `tests/novo-boss-botoes-morte-teleporte.browser.mjs`.
- Documentação: este relatório, `docs/personagem-teste.md` e
  `docs/novo-boss-desenvolvimento.md` com checklist atualizado.

## Validação realizada

- Os **24 arquivos Node** do encontro, ataques, dano, efeitos, controle,
  botões, armas de teste e regressão da Aria passaram.
- `preparar-teleporte-boss.py --verificar`: compara cada PNG/spritesheet com a
  transformação, confere quantidade e duração de todos os quadros GIF, alfa e hashes.
- Chromium real: três texturas carregadas, cliques reais de troca, interação e
  ataque, ataque/interação com 92 × 92 px mesmo em zoom diferente por eixo.
- Saída e entrada no relógio de 250+250 ms, posições reais, espelhamento,
  corpo desativado durante toda a viagem e restaurado apenas ao concluir.
- Derrota real mostra a nova pose por 600 ms, desvanece e some aos 900 ms;
  reinício restaura idle e remove os efeitos anteriores.
- Luta completa de produção em Chromium: **1000 → 0 com 40 impactos reais de
  25**, quatro geradores, barreira, todos os ataques, duas fases, duas ondas de
  clones, vitória, WASD após a vitória, reinício e retorno à cidade.
- Capturas da prévia e dos três botões, saída, chegada e morte foram inspecionadas.
  A sessão visual não registrou erros JavaScript ou de carregamento dos recursos.

Nenhum arquivo existente foi excluído ou renomeado. As fontes WebP/GIF/PNG,
o boss antigo, seus sprites e implementações foram preservados. Mapa, cenas,
ataques, regras de teleporte, multiplayer e arquivos dos colegas não foram
alterados nesta rodada; as mudanças em controles compartilhados são condicionais
às personagens de teste e preservam o comportamento dos demais personagens.

Para repetir a preparação (Pillow 13):

```sh
python3 scripts/preparar-teleporte-boss.py --previa /tmp/previa-teleporte
python3 scripts/preparar-teleporte-boss.py --exportar
python3 scripts/preparar-teleporte-boss.py --verificar
```
