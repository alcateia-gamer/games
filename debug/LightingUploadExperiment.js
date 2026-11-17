/** Protótipo isolado, nunca importado pelo jogo: depende do wrapper desta versão do Phaser. */
export function experimentLightingUpload(texture) {
  const wrapper = texture.source[0].glTexture;
  const original = wrapper._processTexture;
  const canvas = texture.getSourceImage();
  let enabled = false;
  let allocation = { texture: wrapper.webGLTexture, width: wrapper.width,
    height: wrapper.height, format: wrapper.format };
  const stats = { full: 0, reused: 0 };
  function process() {
    const renderer = this.renderer, gl = renderer.gl;
    const reusable = enabled && !gl.isContextLost() && this.pixels === canvas && this.mipLevel === 0 &&
      this.webGLTexture === allocation.texture && this.width === allocation.width &&
      this.height === allocation.height && this.format === allocation.format &&
      canvas.width === this.width && canvas.height === this.height;
    if (!reusable) {
      const result = original.call(this);
      allocation = { texture: this.webGLTexture, width: this.width, height: this.height, format: this.format };
      stats.full++;
      return result;
    }
    // Mesma preparação de estado de WebGLTextureWrapper._processTexture no Phaser local.
    renderer.glTextureUnits.bind(this, 0);
    renderer.glWrapper.updateTexturing({ texturing: { flipY: this.flipY, premultiplyAlpha: this.pma } });
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrapT);
    // Atualiza todos os pixels; só reutiliza armazenamento. Não é upload parcial.
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.format, gl.UNSIGNED_BYTE, canvas);
    this.generateMipmap();
    stats.reused++;
  }
  wrapper._processTexture = process;
  return {
    stats,
    enable(value) { enabled = value; },
    restore() {
      if (wrapper._processTexture === process) wrapper._processTexture = original;
    },
  };
}
