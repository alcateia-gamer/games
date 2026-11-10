# Especificação mestre — Novo boss do jogo

**Finalidade deste documento:** servir como referência central de design e implementação para substituir o boss atualmente usado no jogo por uma nova entidade, desenvolvida do zero em termos de comportamento e mecânicas.

**Importante:** este documento descreve o que foi decidido até agora e separa isso de sugestões que ainda precisam ser aprovadas. Não transforme sugestões ou pontos em aberto em requisitos definitivos sem verificar com o desenvolvedor.

---

## 1. Objetivo geral

O objetivo é implementar um novo boss para o jogo, com identidade visual e combate próprios. O boss antigo já foi ou será desativado no jogo, mas seus arquivos e sua implementação devem permanecer preservados no repositório para possível reutilização futura.

O novo boss deve ser criado sem depender do comportamento específico do boss antigo. Sistemas genéricos já existentes no projeto — por exemplo, vida, dano, colisão, animação, renderização, estados, efeitos ou gerenciamento de entidades — podem e devem ser reutilizados quando forem adequados.

### Regras obrigatórias para o trabalho no repositório

- Não excluir os arquivos do boss antigo.
- Não sobrescrever nem reaproveitar diretamente a implementação antiga sem antes verificar o que é genérico e o que é específico daquele boss.
- Manter a implementação antiga preservada e fora do fluxo normal de jogo.
- Não remover nem alterar funcionalidades de outros inimigos, salas ou sistemas.
- Não fazer refatorações amplas sem necessidade direta para este boss.
- Não presumir nomes de arquivos, funções, bibliotecas ou arquitetura: primeiro inspecionar o repositório real.
- Antes de editar, identificar os pontos de integração do boss antigo e confirmar que ele está realmente desativado.
- Trabalhar em etapas pequenas, revisar as alterações e testar cada etapa antes de avançar.
- Não fazer commit, push, merge ou alteração de branch automaticamente, a menos que isso seja solicitado pelo desenvolvedor.

---

## 2. Identidade e conceito do boss

A entidade tem aparência de uma figura flutuante, encapuzada, com corpo escuro/cinzento, um núcleo ou brilho vermelho na região do rosto/capuz, detalhes claros e dourados, tentáculos vermelhos e mãos mecânicas flutuantes.

A leitura visual pretendida é a de uma entidade que controla o espaço ao redor. Ela não precisa perseguir o jogador continuamente: prefere manter distância, trocar de posição e transformar a arena em uma zona de perigo.

### Fantasia central do combate

**O boss controla a arena; o jogador precisa interpretar os sinais, sobreviver aos padrões e encontrar oportunidades para se aproximar e causar dano.**

O combate deve transmitir:

- Controle de território e pressão à distância.
- Ataques anunciados visualmente, para que o jogador possa reagir.
- Mudanças de posição que obriguem o jogador a se reposicionar.
- Momentos de vulnerabilidade que recompensem aproximação e agressividade.
- Uma segunda fase que intensifique a confusão e a pressão, sem tornar os ataques impossíveis de compreender ou evitar.

### Referências visuais fornecidas

O material visual de referência foi fornecido em duas imagens:

- `referencia_boss_sprite_sheet_completo.png`: folha com várias poses/sequências do boss e variações envolvendo tentáculos e mãos.
- `referencia_boss_sprite_sheet_maos.png`: folha ampliada com uma sequência do corpo principal e mãos mecânicas.

As duas imagens estão incluídas neste pacote. Elas são referências visuais; antes de programar, localize os assets efetivamente usados pelo jogo e confira suas dimensões, transparência, espaçamento, quantidade de frames, ordem dos frames e escala. **Não deduza a grade ou os índices dos frames apenas pelo aspecto visual da imagem.**

---

## 3. Arena e posicionamento

O boss deve usar posições de aparição predeterminadas, em vez de se movimentar livremente por toda a arena.

### Pontos de teletransporte já definidos

Os pontos planejados são:

1. Centro.
2. Lado esquerdo.
3. Lado direito.
4. Parte superior.

Esses pontos também são usados pela primeira mecânica de ilusões, descrita na seção 7.

O boss deve procurar manter uma distância razoável do jogador. O posicionamento deve contribuir para que o jogador tenha de atravessar a arena e lidar com os ataques para alcançar uma janela de dano.

### Elementos da arena: geradores

Haverá geradores na arena. Eles estarão ligados à capacidade do boss de sustentar uma barreira de proteção.

Ainda não foram definidos:

- Quantidade de geradores.
- Posições exatas.
- Se todos precisam ser desativados ou se basta desativar uma quantidade mínima.
- Se os geradores podem ser reativados.
- Se o jogador precisa interagir com eles ou apenas causar dano.
- Se a barreira é permanente enquanto houver energia ou se é ativada apenas em momentos específicos.

O código deve permitir configurar essas regras sem espalhar números fixos por várias partes do projeto. Não assuma que serão quatro geradores só porque existem quatro pontos de teletransporte: são conceitos diferentes.

---

## 4. Regras gerais do combate

### 4.1 Avisos visuais de ataques

A linguagem visual central dos ataques de área será a marcação vermelha no chão.

Quando um ataque precisar atingir uma região específica:

1. A área de perigo aparece no chão antes do impacto.
2. A marcação comunica claramente a região que será atingida.
3. A marcação carrega durante um intervalo configurável.
4. Próximo do impacto, pode pulsar ou intensificar o brilho para comunicar urgência.
5. O ataque acontece na área indicada.
6. O efeito de impacto permanece apenas pelo tempo necessário e então desaparece.

O tempo de aviso deve ser suficiente para o jogador reagir. A marcação não deve aparecer tarde demais nem ser visualmente confundida com decoração do cenário.

### 4.2 Legibilidade e justiça

- O jogador deve conseguir distinguir perigo ativo, aviso de ataque, barreira e janela de vulnerabilidade.
- Não usar ataques inevitáveis sem uma indicação visual ou comportamental que permita antecipá-los.
- Evitar empilhar todos os ataques mais perigosos ao mesmo tempo.
- As combinações devem aumentar a pressão sem eliminar as possibilidades de esquiva.
- Os valores de dano, alcance, duração e recarga devem ser configuráveis e ajustados com testes, não inventados sem observar o sistema atual do jogo.

### 4.3 Dano e vulnerabilidade

A luta deve possuir janelas em que o jogador consiga atingir o corpo principal. O boss não deve ficar vulnerável o tempo inteiro se isso permitir que o jogador simplesmente permaneça ao lado dele e ataque sem considerar suas mecânicas.

Os detalhes exatos de duração, dano recebido e intervalo entre janelas ainda precisam ser equilibrados durante os testes.

---

## 5. Habilidade 1 — Pulso circular de repulsão (referência: “Shinra Tensei”)

### Função

Ataque defensivo de curta distância. Serve para punir o jogador que se aproxima demais do corpo principal.

### Comportamento definido

- O ataque ocorre em uma área circular ao redor do boss.
- Quando o jogador é atingido, recebe dano e é arremessado/empurrado para longe.
- O objetivo principal é criar espaço entre o jogador e o boss.

### Apresentação visual

Usar um efeito circular de expansão em volta do corpo do boss. O efeito deve deixar claro o raio perigoso e o momento em que a onda se expande.

### Segunda utilização visual: barreira

O desenvolvedor também pretende reutilizar o visual/efeito desse ataque para representar um escudo de proteção do boss em determinados momentos.

Essa barreira é sustentada por geradores existentes na arena. Portanto, a lógica da barreira deve considerar o estado dos geradores.

**Atenção:** o pulso ofensivo e a barreira podem compartilhar uma linguagem visual ou assets, mas são comportamentos diferentes e não devem ser confundidos na lógica:

- Pulso: ataque circular, causa dano e repulsão a quem estiver perto.
- Barreira: proteção temporária ou sustentada, ligada aos geradores.

### Pontos ainda em aberto

- Raio da onda.
- Dano e força do empurrão.
- Tempo de preparação, caso exista.
- Duração/forma de ativação da barreira.
- Quantos geradores são necessários para sustentar a barreira.
- Se o boss pode usar a barreira durante qualquer ataque ou apenas em estados específicos.

---

## 6. Habilidade 2 — Chuva de raios / bombardeio de áreas

### Função

Ataque de médio a longo alcance que atinge diversos pontos da arena e força o jogador a se movimentar.

### Comportamento definido

- Diversas áreas circulares aparecem no chão.
- As áreas são marcadas em vermelho.
- Cada marcação indica uma região que será atingida.
- Depois de um tempo de carregamento, vários disparos/raios atingem as regiões marcadas.
- Os impactos podem acontecer em sequência, criando um bombardeio de várias áreas.

### Requisitos de apresentação

- As marcações devem ser visíveis sobre o cenário.
- O tempo de carga precisa ser perceptível.
- O momento do impacto deve ser claro.
- O efeito do impacto não deve esconder por tempo excessivo outras marcações importantes.

### Pontos ainda em aberto

- Quantidade de círculos por execução.
- Se as posições são totalmente aleatórias, em padrões predefinidos ou uma combinação.
- Se algumas áreas são direcionadas à posição do jogador no momento em que o aviso aparece.
- Intervalo entre os disparos.
- Duração do perigo após o impacto.
- Dano e tamanho dos círculos.

**Regra de justiça recomendada:** quando uma marcação for direcionada ao jogador, ela deve registrar a posição prevista no início do aviso. Não deve perseguir indefinidamente a posição atual do jogador, pois isso tornaria a esquiva injusta. Essa regra é uma recomendação de design e pode ser ajustada caso o desenvolvedor decida outra coisa.

---

## 7. Habilidade 3 — Disparos de laser

### Função

Ataque de pressão à distância. Diferente da chuva de raios, não é primariamente um bombardeio de áreas fixas: são projéteis/raios lentos que saem do boss e dificultam a aproximação do jogador.

### Comportamento definido

- O boss realiza diversos disparos de laser.
- Os disparos são relativamente lentos, permitindo que o jogador os leia e desvie.
- Podem ser organizados em padrões, incluindo um padrão em espiral.
- A função é incomodar, ocupar espaço e dificultar que o jogador chegue perto do boss.

### Padrões

**Confirmado como exemplo:**

- Espiral: os projéteis são lançados em uma trajetória organizada ao redor do boss, formando um desenho espiralado.

**Outros padrões possíveis, ainda sujeitos à aprovação e aos testes:**

- Dispersão radial: disparos em várias direções.
- Varredura: sequência de lasers que percorre um arco ou uma faixa da arena.
- Leques alternados: grupos de disparos em ângulos diferentes, criando corredores para atravessar.

Não é necessário implementar todos os padrões de uma vez. Priorizar um padrão funcional e legível; adicionar os demais somente se combinarem com a jogabilidade e o desempenho do jogo.

### Pontos ainda em aberto

- Se são projéteis físicos, feixes contínuos ou outro tipo de entidade de ataque.
- Velocidade, tamanho, quantidade, dano e intervalo dos disparos.
- Se os lasers atravessam obstáculos.
- Se o padrão gira, permanece fixo ou muda durante a execução.

---

## 8. Habilidade 4 — Teletransporte

### Função

Reposicionar o boss para manter distância e mudar o contexto do combate.

### Comportamento definido

- O boss alterna entre os pontos predeterminados: centro, esquerda, direita e parte superior da arena.
- Ela procura permanecer distante do jogador.
- O teletransporte também pode ocorrer se o jogador demorar demais para se aproximar.
- Existe uma condição de teletransporte garantido: quando o jogador consegue atingi-la durante a janela de tempo/abertura de ataque especificada para o combate, ela troca de posição.

### Regras importantes

- O teletransporte deve escolher um ponto válido e diferente da posição atual sempre que possível.
- Não pode posicionar o boss dentro de paredes, obstáculos, geradores ou áreas inválidas.
- Não deve ocorrer em sequência tão rápida que o jogador não consiga reagir ou encontrar a boss.
- O reaparecimento deve ser comunicado visualmente.
- O teletransporte não deve duplicar a entidade nem deixar hitboxes antigas no local anterior.

### Apresentação sugerida

Uma breve sequência de desaparecimento, recolhimento ou distorção dos tentáculos e reaparecimento no ponto de destino. A duração exata deve respeitar o ritmo do jogo.

### Pontos ainda em aberto

- Tempo máximo sem aproximação antes do teletransporte preventivo.
- Se a escolha do próximo ponto é aleatória, cíclica ou ponderada pela distância do jogador.
- Duração da animação e intervalo mínimo entre teletransportes.
- Definição exata da janela em que receber dano força o teletransporte.

---

## 9. Habilidade 5 — Ilusões

Existem duas versões planejadas. A primeira envolve quatro aparições em pontos da arena. A segunda é uma mecânica de clones para a fase abaixo de metade da vida.

### 9.1 Quatro aparições — somente uma verdadeira

**Comportamento definido**

- O boss aparece em quatro pontos: centro, esquerda, direita e parte superior.
- As quatro aparições representam a mesma boss.
- Apenas uma delas é verdadeira.
- A identidade da verdadeira é decidida aleatoriamente quando a mecânica é iniciada.

O jogador deve conseguir descobrir qual aparição é a verdadeira e direcionar seus ataques a ela.

**Ponto importante de design:** o método para identificar a verdadeira ainda não foi definido. É recomendável criar uma pista visual ou comportamental sutil, mas legível, em vez de depender somente de tentativa e erro. Exemplos possíveis: diferença discreta no brilho do núcleo, reação ao jogador ou comportamento dos tentáculos. Essas são propostas, não requisitos confirmados.

### 9.2 Clones móveis — segunda fase

**Gatilho definido:** quando a vida do boss ficar abaixo de 50%.

**Comportamento definido**

- A boss libera vários clones ilusórios a partir do próprio corpo.
- A quantidade planejada é de aproximadamente 8 a 10 clones.
- Os clones se movimentam pelo mapa.
- A boss verdadeira também se movimenta entre eles.
- O propósito é confundir o jogador e dificultar a identificação da entidade verdadeira.

A quantidade deve ser configurável dentro do intervalo planejado de 8 a 10, para facilitar balanceamento e testes.

### Pontos ainda em aberto

- Duração da habilidade.
- Se os clones recebem dano, desaparecem ao serem atingidos ou ignoram dano.
- Se os clones imitam todos os ataques ou apenas alguns movimentos.
- Se a boss verdadeira mantém algum sinal visual identificável.
- Como e quando os clones desaparecem.
- Se a habilidade pode ser repetida na segunda fase e com qual intervalo.

**Recomendação de legibilidade:** mesmo que a identificação seja difícil, o jogador precisa ter alguma possibilidade real de reconhecer a verdadeira. Evitar que 8–10 entidades cubram tanto a tela que seja impossível ler ataques ou localizar o personagem do jogador.

---

## 10. Habilidade 6 — Agarrão dos tentáculos

### Função

Armadilha de contenção que pune o jogador por atravessar áreas perigosas sem observar o chão.

### Comportamento definido

- Tentáculos aparecem em diferentes pontos da arena.
- Se o jogador passar por cima/entrar em contato com um tentáculo ativo, ele pode ser agarrado.
- O agarrão prende o jogador por aproximadamente 2 a 3 segundos.
- O tempo exato pode variar dentro desse intervalo, conforme a configuração ou a situação do ataque.

### Regras de implementação

- A colisão do tentáculo deve ser clara e consistente.
- A captura não deve ocorrer por uma área invisível muito maior que o sprite/indicador.
- O estado de agarrado deve impedir ou limitar a movimentação do jogador pelo tempo configurado.
- Ao terminar o tempo, o jogador deve recuperar o controle normalmente.
- O estado não pode ficar preso por erro, mesmo se o tentáculo for removido, a fase mudar ou o boss morrer.

### Apresentação sugerida

Um aviso visual no chão antes da aparição do tentáculo pode ajudar o jogador a reconhecer a armadilha. O tentáculo pode permanecer exposto ou parcialmente ativo até ser acionado. A forma exata ainda pode ser definida durante os testes.

### Pontos ainda em aberto

- Quantidade de tentáculos simultâneos.
- Tempo entre aviso e aparição, se houver aviso.
- Se o tentáculo desaparece após agarrar alguém.
- Se causa dano além de prender.
- Se existe uma ação para escapar mais cedo ou se a duração é fixa.

---

## 11. Fases da batalha

### Fase 1 — controle da arena

A primeira fase usa o conjunto principal de habilidades:

- Pulso circular de repulsão.
- Barreira ligada aos geradores.
- Chuva de raios.
- Disparos de laser.
- Teletransporte.
- Ilusões com quatro aparições.
- Tentáculos de contenção.

O comportamento deve alternar entre ataques e oportunidades para o jogador se aproximar e causar dano.

### Fase 2 — abaixo de 50% de vida

A segunda fase começa quando a vida do boss fica abaixo de 50%.

A mudança mais importante já definida é a ativação da mecânica dos 8–10 clones móveis que saem do corpo da boss e se movimentam pelo mapa, escondendo a verdadeira.

**Sugestões de intensificação, ainda não obrigatórias:**

- Aumentar moderadamente a frequência dos ataques.
- Variar os padrões dos lasers.
- Criar combinações mais exigentes entre tentáculos e chuva de raios.
- Fazer os teletransportes ocorrerem com maior frequência, respeitando um intervalo mínimo.
- Aumentar a pressão sem simplesmente multiplicar o dano.

A segunda fase não deve retirar todas as janelas de vulnerabilidade. O jogador ainda precisa ter oportunidades compreensíveis para atingir a boss.

---

## 12. Combinações de habilidades

As habilidades devem poder criar situações combinadas, mas o controlador do boss precisa impedir sobreposição excessiva.

Combinações interessantes para testar:

| Combinação | Intenção de gameplay |
|---|---|
| Tentáculos + chuva de raios | Obrigar o jogador a escolher rotas seguras e observar armadilhas no chão. |
| Lasers + teletransporte | Pressionar a aproximação e obrigar o jogador a reposicionar-se. |
| Pulso de repulsão + lasers | Afastar o jogador e dificultar uma nova aproximação imediata. |
| Ilusões + tentáculos | Dividir a atenção entre localizar a verdadeira e evitar armadilhas. |
| Clones + chuva de raios | Criar pressão maior na segunda fase, sem esconder os avisos de impacto. |

Essas combinações são propostas de design. Não devem ser todas ativadas ao mesmo tempo. A prioridade é manter o combate legível e justo.

---

## 13. Organização técnica recomendada

A arquitetura real do jogo deve ser analisada antes de decidir a divisão definitiva dos arquivos. Não criar uma estrutura nova só por preferência se o projeto já tiver padrões consolidados.

Como princípio, manter separadas, sempre que a arquitetura permitir, as responsabilidades de:

### Lógica

- Estado geral do boss.
- Vida, dano e vulnerabilidade.
- Seleção e execução de ataques.
- Temporizadores, intervalos e recargas.
- Posições de teletransporte.
- Controle de clones e ilusões.
- Geradores e barreira.
- Colisões e efeitos de status no jogador.

### Apresentação

- Leitura e execução dos frames do sprite sheet.
- Animações de ataque, teletransporte e dano.
- Indicadores vermelhos no chão.
- Efeitos do pulso e da barreira.
- Efeitos de lasers e impactos.
- Efeitos de aparecimento e desaparecimento dos clones.

### Configuração

Sempre que possível, deixar parâmetros de balanceamento em local centralizado ou em configuração apropriada ao projeto, em vez de espalhar valores mágicos pelo código.

Exemplos de parâmetros configuráveis:

- Vida máxima.
- Distância mínima desejada do jogador.
- Tempo de aviso de cada ataque.
- Dano e raio dos ataques.
- Velocidade e quantidade dos projéteis.
- Intervalo entre ataques.
- Tempo máximo sem aproximação antes do teletransporte.
- Duração do agarrão (2–3 segundos).
- Limite de clones (8–10).
- Gatilho da segunda fase (abaixo de 50%).

A divisão em classes, módulos ou arquivos deve seguir o estilo e as convenções já usadas no repositório.

---

## 14. Plano de implementação recomendado

Não implementar todas as mecânicas de uma só vez. Construir e testar por etapas para reduzir regressões.

### Etapa 0 — auditoria do projeto

1. Inspecionar o repositório e identificar a linguagem, engine/framework e estrutura real.
2. Localizar a implementação antiga e confirmar que ela está desativada, mas preservada.
3. Identificar os sistemas reutilizáveis de inimigos, bosses, dano, colisão, animação, efeitos, mapas e HUD.
4. Identificar a sala/arena e como um boss é instanciado nela.
5. Localizar os sprites reais da nova boss e verificar o formato dos arquivos.
6. Apresentar um plano técnico que cite os arquivos reais que serão criados ou alterados.

### Etapa 1 — esqueleto do novo boss

1. Criar a entidade do novo boss.
2. Integrar vida, dano, colisão e renderização.
3. Implementar estados básicos: entrada, posicionamento, preparação, ataque, vulnerabilidade, teletransporte e derrota, adaptando os nomes à arquitetura existente.
4. Colocar o boss na arena sem ainda adicionar todas as habilidades.
5. Testar que a sala carrega, que o boss aparece e que recebe dano corretamente.

### Etapa 2 — teletransporte e janelas de vulnerabilidade

1. Configurar os quatro pontos de aparição.
2. Implementar o teletransporte reativo após ser atingida na janela prevista.
3. Implementar o teletransporte preventivo quando o jogador demora demais para se aproximar.
4. Garantir validação de destino e intervalo mínimo entre teletransportes.
5. Testar que o boss não desaparece, duplica ou reaparece em locais inválidos.

### Etapa 3 — ataques básicos e avisos

1. Implementar a infraestrutura visual/temporal das marcações vermelhas.
2. Implementar o pulso circular de repulsão.
3. Implementar a chuva de raios.
4. Implementar o padrão inicial de lasers em espiral.
5. Implementar os tentáculos de contenção.
6. Testar cada habilidade isoladamente antes de permitir combinações.

### Etapa 4 — geradores e barreira

1. Integrar os geradores à arena.
2. Implementar a condição que sustenta ou permite a barreira.
3. Reutilizar a linguagem visual do pulso circular sem misturar a lógica dos dois comportamentos.
4. Testar todos os estados possíveis dos geradores.

### Etapa 5 — ilusões e segunda fase

1. Implementar as quatro aparições e selecionar apenas uma verdadeira.
2. Implementar uma indicação justa para que o jogador consiga identificar a verdadeira, caso essa solução seja aprovada.
3. Implementar a transição abaixo de 50% de vida.
4. Fazer 8–10 clones saírem do corpo e movimentarem-se pelo mapa.
5. Garantir que a boss verdadeira possa ser identificada e atingida.
6. Testar legibilidade e desempenho com todos os clones ativos.

### Etapa 6 — integração, balanceamento e regressão

1. Implementar uma seleção controlada de ataques e combinações.
2. Ajustar frequência, dano, duração, velocidade e quantidade.
3. Testar as duas fases do início ao fim.
4. Testar a derrota e a transição/retorno normal do jogo.
5. Verificar se outros inimigos, salas, menus e sistemas continuam funcionando.
6. Corrigir erros e documentar limitações restantes.

---

## 15. Critérios de aceitação

A implementação só deve ser considerada pronta quando:

- O boss antigo continuar preservado nos arquivos e não aparecer no fluxo normal do jogo.
- O novo boss aparecer corretamente na arena pretendida.
- Os quatro pontos de teletransporte funcionarem sem destinos inválidos.
- O teletransporte reativo ocorrer quando a condição de dano/janela for atendida.
- O teletransporte preventivo puder ocorrer quando o jogador demorar demais para se aproximar.
- O pulso circular causar dano e empurrar o jogador quando ele estiver no alcance.
- A barreira depender corretamente do estado dos geradores.
- A chuva de raios mostrar áreas de aviso antes dos impactos.
- Os disparos de laser criarem padrões legíveis e permitirem esquiva.
- Os tentáculos prenderem o jogador por aproximadamente 2–3 segundos e sempre devolverem o controle.
- A ilusão das quatro aparições apresentar somente uma boss verdadeira.
- A segunda fase começar abaixo de 50% de vida.
- A segunda fase gerar aproximadamente 8–10 clones que se movimentem pelo mapa.
- A boss verdadeira continuar identificável e vulnerável em momentos apropriados.
- Não haver regressões em outras partes do jogo.
- Não existirem erros persistentes no console durante a luta.

---

## 16. Decisões ainda pendentes

Não inventar respostas para estes pontos. Durante a auditoria, o Codex pode indicar quais decisões afetam a arquitetura; as decisões de design devem ser confirmadas pelo desenvolvedor.

1. A arena antiga será reaproveitada, modificada ou substituída por uma nova?
2. Quantos geradores existirão e onde ficarão?
3. A barreira depende de todos os geradores ou de uma quantidade mínima?
4. Os geradores podem ser reativados? Como o jogador interage com eles?
5. Quanto tempo o jogador pode ficar distante antes do teletransporte preventivo?
6. Qual é a duração exata das janelas de vulnerabilidade?
7. Quais são os valores de dano, raio, velocidade e recarga de cada ataque?
8. Quantos círculos aparecem na chuva de raios e como suas posições são escolhidas?
9. Quais padrões de laser serão implementados além da espiral?
10. Como o jogador identifica a verdadeira entre as quatro aparições?
11. Como os clones se comportam quando são atingidos? Eles imitam ataques ou só se movimentam?
12. Os tentáculos causam dano além de prender? É possível escapar antes do fim dos 2–3 segundos?
13. Quais ataques podem ser combinados e quais nunca devem ocorrer simultaneamente?
14. Qual será a animação/efeito final da derrota do boss?

---

## 17. Prompt inicial para o Codex

Use este documento como especificação central do novo boss. Antes de alterar o código, faça uma auditoria do repositório e apresente um plano técnico baseado na implementação real do jogo.

**Não comece apagando ou substituindo arquivos do boss antigo.** A implementação antiga deve continuar preservada e desativada. Não faça alterações em arquivos de colegas ou em sistemas sem relação com o novo boss.

Depois da auditoria:

1. Liste os arquivos e sistemas existentes que podem ser reutilizados.
2. Liste os arquivos que precisarão ser criados ou alterados.
3. Explique como pretende integrar o novo boss à arena e ao ciclo de jogo.
4. Aponte riscos técnicos, dependências e decisões pendentes deste documento.
5. Proponha uma ordem de implementação em etapas pequenas e testáveis.

Ao implementar, siga as decisões confirmadas deste documento e mantenha os pontos pendentes configuráveis ou aguarde confirmação quando a escolha alterar significativamente o design. Não invente mecânicas adicionais como se tivessem sido aprovadas.

Após cada etapa, informe o que foi alterado, quais testes executou, os resultados e o que ainda falta. Preserve o funcionamento do restante do jogo.

---

## 18. Resumo executivo

O novo boss é uma entidade flutuante com tentáculos vermelhos e mãos mecânicas. Ela controla o espaço da arena e busca manter distância do jogador usando pontos fixos de teletransporte.

Suas mecânicas centrais são:

1. Pulso circular de curta distância que causa dano e arremessa o jogador.
2. Barreira de proteção visualmente relacionada ao pulso, sustentada por geradores.
3. Chuva de raios com múltiplas áreas circulares vermelhas que carregam antes dos impactos.
4. Disparos de laser relativamente lentos, incluindo padrões como espiral, para dificultar a aproximação.
5. Teletransporte entre centro, esquerda, direita e parte superior, tanto reativo quanto preventivo.
6. Ilusões: quatro aparições com apenas uma verdadeira e, abaixo de 50% de vida, aproximadamente 8–10 clones móveis.
7. Tentáculos que podem agarrar o jogador por cerca de 2–3 segundos.

O objetivo do combate é exigir leitura dos avisos, movimentação, posicionamento e escolha de momentos para atacar. A luta deve ser desafiadora, mas justa e visualmente legível.
