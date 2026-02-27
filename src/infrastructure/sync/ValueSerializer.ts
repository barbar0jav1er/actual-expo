/**
 * Serializes values for CRDT message storage.
 * Format: "TYPE:VALUE"
 *   null/undefined -> "0:"
 *   number         -> "N:123"
 *   string         -> "S:text"
 */
export class ValueSerializer {
  static serialize(value: unknown): string {
    if (value === null || value === undefined) {
      return '0:'
    }
    if (typeof value === 'number') {
      return `N:${value}`
    }
    if (typeof value === 'string') {
      return `S:${value}`
    }
    throw new Error(`Cannot serialize value of type ${typeof value}`)
  }

  static deserialize(str: string): unknown {
    const colonIndex = str.indexOf(':')
    if (colonIndex === -1) {
      throw new Error(`Invalid serialized value: ${str}`)
    }

    const type = str.substring(0, colonIndex)
    const value = str.substring(colonIndex + 1)

    switch (type) {
      case '0':
        return null
      case 'N': {
        const num = Number(value)
        if (!Number.isFinite(num)) {
          throw new Error(`Invalid number value: ${value}`)
        }
        return num
      }
      case 'S':
        return value
      default:
        throw new Error(`Unknown serialized type: ${type}`)
    }
  }
}
