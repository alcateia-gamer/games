# Introdução na televisão e carregamento

A apresentação começa em `BootPartida`, depois de escolher o personagem e iniciar a partida. A `televisao.gif` original fica animada enquanto o MP4 é reproduzido dentro da tela. As importações das fases e o carregamento dos recursos acontecem em paralelo, sem barra de progresso e sem porcentagem.

O jogo só entra em `Level1` quando **o vídeo terminou ou foi pulado e os recursos estão prontos**. O GIF repete seu ciclo de 2,88 s durante toda a apresentação: moldura, feixe e fundo continuam animados. A janela interna permanece coberta por uma superfície preta e pelo vídeo, sem deixar a estática original aparecer. Esse GIF não possui as interferências da TV horror. Se o vídeo acabar antes do carregamento, a tela da TV fica preta. Falhas em recursos oferecem uma tentativa adicional; falhas de reprodução oferecem continuar. Pular nunca ignora uma falha do loader. A apresentação é removida ao entrar na fase, encerrar a cena ou destruir o jogo.

Ao tocar em **Pular introdução**, o GIF é congelado apenas para o desligamento: a imagem se comprime em uma linha luminosa, fecha em um ponto e desaparece; a TV e o feixe escurecem. O efeito dura 480 ms e bloqueia a entrada na fase até terminar, mesmo com os recursos já carregados. Se o carregamento ainda estiver pendente, a TV permanece apagada até os recursos chegarem. Encerrar a cena cancela os temporizadores da animação.

## Encaixe e arquivos originais

- `assets/efeitos/televisao.gif`: TV atual, 800×600, 72 quadros de 40 ms; preservada integralmente.
- `assets/efeitos/televisao-horror.gif` e seus derivados anteriores: preservados, sem uso nesta apresentação.
- `derivados/televisao-estatica.png`: último quadro da TV original extraído integralmente, sem redesenho; usado apenas ao desligar ou como alternativa se o GIF falhar. Durações, dimensões e hash do GIF estão em `derivados/televisao-original.json`.
- A janela medida fica em x=226, y=190, largura=286, altura=199. O ajuste de um pixel cobre a fileira superior e a coluna direita de estática sem avançar sobre a borda inferior do vidro.
- Uma superfície preta cobre o ruído da tela mesmo antes de o vídeo começar. Seu canto inferior direito tem raio equivalente a 4 pixels na arte, preservando a curva da moldura; os quatro cantos do vídeo também são levemente arredondados.
- O enquadramento usa a composição inteira de 800×600, com escala uniforme do tipo `contain`: sem zoom focal, sem corte do feixe ou das extremidades e sem máscara de transparência na imagem principal. A prioridade de conferência é o celular na horizontal.
- A apresentação ocupa toda a janela. Uma cópia desfocada do mesmo GIF preenche apenas o fundo, enquanto a imagem principal permanece completa. Essa camada auxiliar pode ser recortada para preencher telas de proporções diferentes. A TV principal fica inteira; as margens necessárias preservam o formato original. O fundo continua animado até o desligamento.
- O MP4 usa `object-fit: cover`, posição central e escala uniforme para preencher o vidro sem barras laterais extras. A diferença entre o vídeo 4:3 e a janela é compensada por um recorte vertical de aproximadamente 3,6% em cada extremidade, sem esticar a imagem. Isso não modifica o MP4 original ou o derivado.
- Apenas as inserções verticais de ruído verde (quadros 424–441, 16,96–17,64 s) e vermelho (499–521, 19,96–20,84 s) recebem um recorte central proporcional 4:3. O padrão deixa de aparecer como uma faixa comprida, sem distorção ou mudança de duração. As demais cenas mantêm o enquadramento original.
- `assets/efeitos/cutscene.mp4`: original 1440×1080, 779 quadros, 25 fps, 31,16 s, 32.279.799 bytes; preservado.
- `assets/efeitos/derivados/cutscene-tv.mp4`: cópia 960×720, mesmos 779 quadros e 31,16 s, áudio preservado, 12.708.869 bytes. O índice MP4 fica no início (`faststart`) para começar a reprodução durante o download.

Os hashes dos três originais estão registrados em `assets/efeitos/derivados/cutscene-tv.json` e foram conferidos após a conversão. Para gerar novamente os derivados, instalar Pillow e FFmpeg (ou imageio-ffmpeg) e executar:

```sh
python scripts/preparar-cutscene-tv.py
```

Para preparar somente a TV atual, sem recodificar o MP4 ou alterar os derivados históricos da TV horror:

```sh
python scripts/preparar-cutscene-tv.py --television-only
```

## Arquivos de implementação

| Arquivo | Alteração |
| --- | --- |
| `js/scenes/BootPartida.js` | Inicia a apresentação junto às importações e transfere sua propriedade ao preloader. |
| `js/scenes/preloader.js` | Carrega a mesma fila de recursos, substitui o progresso visual pela apresentação e aguarda as duas condições para iniciar a fase. |
| `js/ui/CutsceneLoading.js` | GIF, vídeo nativo, reprodução, redimensionamento, desligamento ao pular, falhas e limpeza dos elementos/eventos. |
| `js/ui/CutsceneTelevision.js` | Reprodução contínua do GIF original e congelamento somente ao desligar. |
| `js/ui/CutsceneLayout.js` | Coordenadas medidas, enquadramento integral do GIF e controle de conclusão única. |
| `style.css` | Estilos exclusivos da apresentação. |
| `scripts/preparar-cutscene-tv.py` | Geração reproduzível da cópia de streaming e verificação dos originais. |

## Validação

- `node js/ui/CutsceneLayout.test.mjs`: três testes de encaixe e sincronização, incluindo ambas as ordens de conclusão e proteção contra entrada duplicada.
- `tests/cutscene-carregamento.browser.mjs`: teste real no Chromium, com seleção pelo menu e reprodução do MP4, aguardando cada instante da sequência em vez de pressupor suporte HTTP Range para saltos.
- Cenários de navegador: entrada normal com Aria, desligamento por toque com recursos prontos, carregamento lento em dispositivo móvel com salto antecipado, vídeo indisponível e recurso indisponível seguido de nova tentativa.
- Encaixe conferido em três celulares na horizontal (844×390, 932×430, 667×375), PC (1280×720, 1920×720) e retrato (390×844); capturas aos 2,5, 12, 17,2, 17,8, 20,4 e 28 segundos, incluindo os dois ruídos reenquadrados e o código verde preservado.
- O teste verifica o GIF original em 800×600 e a superfície preta da janela, inclusive ao pular antes do carregamento.
- Após vários ciclos, o teste pausa o MP4 e compara capturas: o feixe do GIF muda, mas o conteúdo dentro da tela permanece idêntico. Também verifica que o vídeo avança normalmente com o GIF em loop.
- Em cada tamanho de tela, o fundo cobre toda a janela e o GIF principal completo permanece dentro dos limites visíveis, sem deformação.
- O teste móvel usa toque real no botão de pular e verifica a animação CRT antes de a fase ser liberada. Também verifica que, em uma conexão lenta, o desligamento termina e a fase continua bloqueada até o mapa chegar.
- `tests/menu-carregamento.browser.mjs`: regressão do menu, seleção, carregamento da biblioteca multiplayer sob demanda e chegada da partida solo à cidade.
- `git diff --check`: sem erros de espaços.

Para reproduzir a validação de navegador, servir a raiz por HTTP e executar com Playwright instalado:

```sh
node tests/cutscene-carregamento.browser.mjs
```

São aceitos `GAME_URL`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `ARTIFACT_DIR` e `SCENARIO` (`all`, `desktop`, `skip`, `slow`, `video-error`, `retry`). Os relatórios e capturas ficam por padrão em `/tmp/cutscene-validacao`; a revisão do GIF contínuo e do novo encaixe foi registrada em `/tmp/tv-animada/browser`. Não há alteração em combate, mapas, configurações do broker ou sprites originais. A validação foi feita no Chromium; não inclui dispositivos iOS físicos.
