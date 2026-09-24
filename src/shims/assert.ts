// Browser stand-in for Node's `assert`, which poker-ts requires.
export default function assert(value: unknown, message = 'Assertion failed'): asserts value {
  if (!value) throw new Error(message)
}
