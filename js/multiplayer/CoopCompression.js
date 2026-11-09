/** Gzip nativo opcional, negociado por todos os jogadores; sem biblioteca no jogo. */
export const supportsCompression = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";
export async function encodeFrame(json) {
  const raw = new TextEncoder().encode(json);
  if (!supportsCompression() || raw.byteLength < 2048) return raw;
  const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return compressed.byteLength < raw.byteLength ? compressed : raw;
}
export async function decodeFrame(bytes) {
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error("Quadro de rede excede o limite");
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader(), chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error("Quadro descompactado excede o limite"); }
    chunks.push(value);
  }
  const result = new Uint8Array(size); let offset = 0;
  for (const part of chunks) { result.set(part, offset); offset += part.byteLength; }
  return new TextDecoder().decode(result);
}
