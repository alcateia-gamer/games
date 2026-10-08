# Shader de chuva e neve adaptado para Phaser 3

Este módulo é uma adaptação do algoritmo do shader Godot fornecido, preservando as camadas de gotas próximas/distantes, inclinação, comprimentos e velocidades variáveis. O efeito de neve usa flocos sem rastro; chuva usa rastro suavizado.

## Instalação

1. Copie `js/effects/WeatherShader.js` para a mesma pasta do seu projeto.
2. Copie `LICENSE-Rain-and-Snow.txt` para o repositório e mantenha o cabeçalho de atribuição.
3. No início de `js/scenes/Level1.js`, importe:

```js
import WeatherShader from '../effects/WeatherShader.js';
```

4. No final do `create()` de `Level1`, depois de criar o mapa e a câmera:

```js
this.weather = new WeatherShader(this, 'rain'); // ou 'snow'
```

5. No `update(time, delta)` **existente**, perto do início e antes de retornos antecipados de hit-stop, inclua:

```js
this.weather?.update(time, delta);
```

Não crie outro `update()` ou `create()`. O módulo limpa o efeito quando a cena encerra.

## Controle

```js
this.weather.setMode('snow'); // muda para neve
this.weather.setMode('rain'); // muda para chuva
this.weather.setIntensity(300); // densidade das colunas de chuva
this.weather.shader.setVisible(false); // desliga visualmente
this.weather.shader.setVisible(true); // liga novamente
```

## Atenção

- Requer Phaser 3 com **WebGL**. Canvas não executa este shader.
- Não há colisão nem modificação na física dos personagens.
- O efeito fica fixo na tela (screen-space), acima do mapa. Para coberturas/telhados que bloqueiem chuva, será preciso uma máscara específica.
- A adaptação foi preparada a partir do shader original, mas **não foi executada dentro do jogo**. Teste com a versão real de Phaser e ajuste a API de uniforms se necessário.
- Caso o jogo utilize múltiplas câmeras ou resolução interna diferente do viewport, poderá ser necessário adaptar as coordenadas de `gl_FragCoord`.
