// Browser stand-in for Node's `crypto.randomInt`, used by poker-ts to shuffle.
export function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max // reject to avoid modulo bias
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}
