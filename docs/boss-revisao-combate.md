# Revisão do combate do boss — 13/11/2026

Atualização posterior: [recarga restaurada, portais menores e camuflagem em grupos](boss-ajustes-portais-recarga.md). O registro abaixo descreve a revisão anterior.

## Checklist integrado

- [x] Na recarga após os dois impactos, todos os geradores sobreviventes sobem
  usando a animação `summon`. Aceitam dano, com vida mínima de 1 durante a recarga.
  Acertos não reiniciam a animação. A próxima onda espera a subida terminar e o
  espaço do escudo ficar livre. Fora dessa janela, os geradores voltam a morrer normalmente.
- [x] Efeitos geométricos antigos de transição, teleporte e imitação estão
  desativados em produção; as animações atuais e os avisos dos golpes continuam.
  Foram retiradas as linhas soltas da recarga e o anel geométrico de falha do escudo.
- [x] Portais opacos, acima da iluminação ambiente, com escala de 0,65 em vez de
  0,35. Os dois ficam na linha Y central da arena, junto às paredes laterais,
  validando colisões e a passagem do robô. Na arena atual: `(-1531, -5769)` e
  `(-627, -5769)`. O portal esquerdo continua espelhado.
- [x] Verdadeira e nove clones saem juntos em direções distintas; a direção
  reservada à verdadeira é sorteada. A fase 2 reserva 3,2 s antes dos ataques
  para dispersão a 220 px/s; depois as cópias e a verdadeira percorrem a arena
  a 160 px/s enquanto o estado permite. Os corpos respeitam paredes, limites,
  geradores, jogador e as pausas dos ataques centrais. As animações continuam
  sincronizadas e os ataques falsos continuam sem dano.
- [x] Chuva perseguindo o jogador acelerada: intervalo de 400 para 240 ms;
  aviso até o impacto de 1.400 para 930 ms. Alterna com anéis de círculos de
  raios que avançam para fora a cada 320 ms, partindo da posição do boss.
  Cada círculo tem aviso e dano no instante de impacto. As cópias usam o mesmo
  campo anunciado para evitar dez ondas sobrepostas cobrindo a tela. No padrão
  em anéis, o quadro 3 de flash branco é substituído pelo quadro 2 do próprio
  efeito; nenhum PNG foi alterado. O restante da animação mantém os feixes.
- [x] Espiral mantém seus 100 disparos e acrescenta 56 em rajadas circulares,
  diagonais e horizontais durante os mesmos 10 s. O boss recebe 50% do dano
  enquanto está emitindo; recebe dano integral durante o aviso e a cauda.
  As cópias reproduzem a mesma agenda, sem registrar projéteis ofensivos.
- [x] Cadáver permanece visível e bloqueia a passagem. Sua colisão usa os limites
  medidos da pose de morte, com escala e espelhamento corretos, e entra na
  navegação existente. A réplica cooperativa também cria esse obstáculo. A
  limpeza do encontro remove somente a colisão que ele criou.

## Arquivos de implementação

| Arquivos | Alteração |
| --- | --- |
| `js/enemies/novoBoss/NovoBossPrologo.js`, `NovoBossTorres.js` | Subida na recarga, dano não fatal e espera pela conclusão. |
| `NovoBossApresentacao.js`, `NovoBossIlusoes.js` | Desativação dos desenhos geométricos antigos. |
| `NovoBossPortais.js`, `NovoBossAssets.js` | Linha central, escala, opacidade e profundidade dos portais. |
| `NovoBossClones.js`, `NovoBossFases.js`, `NovoBossMovimento.js` | Dispersão, trajetórias e pausas compartilhadas. |
| `NovoBossAtaques.js`, `NovoBossAtaquesIlusorios.js` | Alternância da chuva e reprodução visual sem dano. |
| `ataques/ChuvaRaios.js`, `ataques/LasersEspiral.js` | Anéis de raios e padrões simultâneos de projéteis. |
| `NovoBossEstados.js`, `NovoBossConfig.js` | Preparação dos clones, resistência temporária e parâmetros. |
| `NovoBossCorpoDerrotado.js` (novo), `js/enemies/BossPrincipal.js` | Colisão do cadáver e sua limpeza. |
| `js/multiplayer/CoopBossReplica.js` | Colisão correspondente no cliente cooperativo. |

Os nomes sem diretório na tabela pertencem a `js/enemies/novoBoss/`.
Os testes unitários desses subsistemas foram atualizados e ganharam regressões
para a recarga, ausência de geometria antiga, anéis, sincronização, resistência,
trajetória dos projéteis e colisão do cadáver. Foi criado
`NovoBossCorpoDerrotado.test.mjs` e o roteiro integrado
`tests/novo-boss-revisao-combate.browser.mjs`.
O roteiro `tests/novo-boss-prologo.browser.mjs` passou a exigir a linha horizontal
central entre ondas, em lugar da antiga alternância entre alturas.

## Validação

- 467 casos em 37 arquivos pertinentes passaram: boss, ataques, multiplayer e
  Robô Bola, incluindo suas colisões e saída do portal.
- No Chromium com Phaser real, o roteiro novo concluiu os quatro ciclos e
  verificou a subida quadro a quadro, dano não fatal, portais, dispersão,
  animações sincronizadas, chuva alternada, padrões simultâneos e resistência
  de 50% somente durante a emissão. Testou a passagem pelos dois lados do
  cadáver e a remoção do obstáculo ao encerrar o encontro.
- Foram inspecionadas as seis capturas de tela. A revisão visual encontrou e
  corrigiu sobreposição excessiva do flash dos anéis e um redimensionamento
  da colisão estática para 32 px. A colisão final mede 108,9 × 107,25 px.
- Prévia e relatório integrado: `/tmp/boss-revisao-combate/`.
- O roteiro existente do prólogo também passou nas 86 verificações, incluindo
  ocupação das bases, restauração segura do escudo, preservação das colisões
  alheias, saída da arena, reentrada e morte do jogador.
- A suíte geral mantém falhas anteriores em quatro arquivos: iluminação da
  fábrica, colisões do mapa, configurações de colisão do jogador e áudio da
  serra ausente. Esses sistemas não foram modificados nesta revisão.

Nenhum arquivo foi excluído ou renomeado. Imagens, GIFs, mapas, áudios e recursos
originais permaneceram sem alterações. Não foi feito commit desta revisão.
