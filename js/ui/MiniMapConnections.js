/**
 * Liga a calçada alcançável usando a mesma cor do asfalto, sem cruzar colisões.
 * A superfície usa alpha quase opaco para que paredes finas também separem os caminhos.
 */
export function connectSidewalks(surface, asphalt, width, height) {
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Uint32Array(count);
  const result = new Uint8ClampedArray(asphalt);
  let head = 0, tail = 0;
  const visit = (index, from = index) => {
    if (!visited[index] && surface[index * 4 + 3] >= 250) {
      visited[index] = 1;
      const offset = index * 4, source = from * 4;
      result[offset] = result[source];
      result[offset + 1] = result[source + 1];
      result[offset + 2] = result[source + 2];
      result[offset + 3] = surface[offset + 3];
      queue[tail++] = index;
    }
  };
  for (let index = 0; index < count; index++) {
    if (asphalt[index * 4 + 3] >= 250) visit(index);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) visit(index - 1, index);
    if (x < width - 1) visit(index + 1, index);
    if (index >= width) visit(index - width, index);
    if (index + width < count) visit(index + width, index);
  }
  return result;
}
