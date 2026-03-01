// Serialization format used by loot-core sync messages
// Values are encoded as: '0:' (null), 'N:42' (number), 'S:text' (string)

export function serializeValue(value: string | number | null): string {
  if (value === null || value === undefined) return '0:'
  if (typeof value === 'number') return 'N:' + value
  if (typeof value === 'string') return 'S:' + value
  throw new Error('Cannot serialize value of type: ' + typeof value)
}

export function deserializeValue(value: string): string | number | null {
  const type = value[0]
  switch (type) {
    case '0':
      return null
    case 'N':
      return parseFloat(value.slice(2))
    case 'S':
      return value.slice(2)
    default:
      throw new Error('Invalid type key: ' + type)
  }
}
