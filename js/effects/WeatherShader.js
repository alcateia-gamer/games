/*
 * Adapted from "Rain and Snow shader" by Brian Smith
 * https://steampunkdemon.itch.io/rain-and-snow-shader-with-parallax-effect-for-godot
 * Original Copyright (c) 2023 Brian Smith; MIT License.
 * See LICENSE-Rain-and-Snow.txt alongside this module.
 * Phaser 3 WebGL (GLSL ES 1.00).
 */

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uAmount;
uniform float uNearLength;
uniform float uFarLength;
uniform float uNearWidth;
uniform float uFarWidth;
uniform float uNearAlpha;
uniform float uFarAlpha;
uniform vec3 uColor;
uniform float uBaseSpeed;
uniform float uExtraSpeed;
uniform float uSlant;
uniform float uSnow;

void main(void) {
    // gl_FragCoord is bottom-up; convert to top-down screen coordinates.
    vec2 uv = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / max(uResolution, vec2(1.0));
    float amount = max(uAmount, 1.0);
    float remainder = mod(uv.x - uv.y * uSlant, 1.0 / amount);
    float column = (uv.x - uv.y * uSlant) - remainder;
    float depth = fract(sin(column * amount));
    float phase = fract(uv.y + depth - uTime * (uBaseSpeed + uExtraSpeed * depth));
    float lengthPx = mix(uFarLength, uNearLength, depth);
    float widthPx = mix(uFarWidth, uNearWidth, depth);
    float opacity = mix(uFarAlpha, uNearAlpha, depth);
    float trail = smoothstep(1.0 - lengthPx, 1.0, phase);
    float flake = step(1.0 - lengthPx, phase);
    float coverage = step(remainder * amount, widthPx / 8.0);
    float alpha = mix(trail, flake, uSnow) * coverage * opacity;
    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));
}
`;

const DEFAULTS = {
  rain: { amount: 200, nearLength: 0.20, farLength: 0.10, nearWidth: 1.0, farWidth: 0.5, nearAlpha: 0.65, farAlpha: 0.3, color: [0.8, 0.85, 1.0], baseSpeed: 0.5, extraSpeed: 0.5, slant: 0.2, snow: 0 },
  snow: { amount: 110, nearLength: 0.025, farLength: 0.012, nearWidth: 0.8, farWidth: 0.5, nearAlpha: 0.95, farAlpha: 0.5, color: [1, 1, 1], baseSpeed: 0.07, extraSpeed: 0.12, slant: -0.08, snow: 1 }
};

function uniforms(p, width, height) {
  const f = value => ({ type: '1f', value });
  return {
    uResolution: { type: '2f', value: { x: width, y: height } },
    uTime: f(0), uAmount: f(p.amount), uNearLength: f(p.nearLength),
    uFarLength: f(p.farLength), uNearWidth: f(p.nearWidth),
    uFarWidth: f(p.farWidth), uNearAlpha: f(p.nearAlpha),
    uFarAlpha: f(p.farAlpha),
    uColor: { type: '3f', value: { x: p.color[0], y: p.color[1], z: p.color[2] } },
    uBaseSpeed: f(p.baseSpeed), uExtraSpeed: f(p.extraSpeed),
    uSlant: f(p.slant), uSnow: f(p.snow)
  };
}

export default class WeatherShader {
  constructor(scene, mode = 'rain', options = {}) {
    if (!scene.game.renderer || scene.game.renderer.type !== Phaser.WEBGL) {
      throw new Error('WeatherShader requer o renderizador WebGL do Phaser 3.');
    }
    this.scene = scene;
    this.elapsed = 0;
    this.mode = mode;
    this.settings = { ...(DEFAULTS[mode] || DEFAULTS.rain), ...options };
    const width = scene.scale.width;
    const height = scene.scale.height;
    const key = 'weather-rain-snow-shader';
    const shaderCache = scene.cache.shader || scene.cache.shaders;
    if (!shaderCache) {
      throw new Error("[Weather] Cache de shaders do Phaser não está disponível.");
    }
    if (!shaderCache.exists(key)) {
      shaderCache.add(
        key,
        new Phaser.Display.BaseShader(key, FRAGMENT_SHADER, null),
      );
    }
    this.shader = scene.add
      .shader(
        key,
        width / 2,
        height / 2,
        width,
        height,
        uniforms(this.settings, width, height),
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100000)
      .setAlpha(1)
      .setVisible(true);
    if (!this.shader) {
      throw new Error("[Weather] Não foi possível criar o objeto shader.");
    }
    this.onResize = this.resize.bind(this);
    scene.scale.on('resize', this.onResize);
    this.onShutdown = this.destroy.bind(this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
  }

  update(time, delta) {
    if (!this.shader || !this.shader.active) return;
    this.elapsed += delta / 1000;
    this.shader.setUniform('uTime.value', this.elapsed);
  }

  resize(gameSize) {
    if (!this.shader || !this.shader.active) return;
    const width = gameSize.width;
    const height = gameSize.height;
    this.shader.setPosition(width / 2, height / 2);
    this.shader.setSize(width, height);
    this.shader.setUniform('uResolution.value.x', width);
    this.shader.setUniform('uResolution.value.y', height);
  }

  setMode(mode) {
    const settings = DEFAULTS[mode];
    if (!settings) throw new Error('Modo inválido: use rain ou snow.');
    this.mode = mode;
    this.settings = { ...settings };
    const map = {
      uAmount: 'amount', uNearLength: 'nearLength', uFarLength: 'farLength',
      uNearWidth: 'nearWidth', uFarWidth: 'farWidth', uNearAlpha: 'nearAlpha',
      uFarAlpha: 'farAlpha', uBaseSpeed: 'baseSpeed', uExtraSpeed: 'extraSpeed',
      uSlant: 'slant', uSnow: 'snow'
    };
    for (const [uniform, field] of Object.entries(map)) {
      this.shader.setUniform(`${uniform}.value`, settings[field]);
    }
    this.shader.setUniform('uColor.value.x', settings.color[0]);
    this.shader.setUniform('uColor.value.y', settings.color[1]);
    this.shader.setUniform('uColor.value.z', settings.color[2]);
  }

  setIntensity(amount) {
    this.shader.setUniform('uAmount.value', Math.max(1, amount));
  }

  destroy() {
    if (!this.scene) return;
    this.scene.scale.off('resize', this.onResize);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    if (this.shader) this.shader.destroy();
    this.shader = null;
    this.scene = null;
  }
}
