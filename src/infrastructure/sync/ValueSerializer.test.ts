import { describe, it, expect } from 'vitest'
import { ValueSerializer } from './ValueSerializer'

describe('ValueSerializer', () => {
  describe('serialize', () => {
    it('serializes null to "0:"', () => {
      expect(ValueSerializer.serialize(null)).toBe('0:')
    })

    it('serializes undefined to "0:"', () => {
      expect(ValueSerializer.serialize(undefined)).toBe('0:')
    })

    it('serializes positive integer', () => {
      expect(ValueSerializer.serialize(12345)).toBe('N:12345')
    })

    it('serializes negative integer', () => {
      expect(ValueSerializer.serialize(-500)).toBe('N:-500')
    })

    it('serializes zero', () => {
      expect(ValueSerializer.serialize(0)).toBe('N:0')
    })

    it('serializes string', () => {
      expect(ValueSerializer.serialize('hello')).toBe('S:hello')
    })

    it('serializes string with colons', () => {
      expect(ValueSerializer.serialize('a:b:c')).toBe('S:a:b:c')
    })

    it('serializes empty string', () => {
      expect(ValueSerializer.serialize('')).toBe('S:')
    })

    it('throws for unsupported types', () => {
      expect(() => ValueSerializer.serialize({})).toThrow()
      expect(() => ValueSerializer.serialize(true)).toThrow()
    })
  })

  describe('deserialize', () => {
    it('deserializes "0:" to null', () => {
      expect(ValueSerializer.deserialize('0:')).toBeNull()
    })

    it('deserializes "N:123" to number 123', () => {
      expect(ValueSerializer.deserialize('N:123')).toBe(123)
    })

    it('deserializes "N:-500" to number -500', () => {
      expect(ValueSerializer.deserialize('N:-500')).toBe(-500)
    })

    it('deserializes "S:hello" to string "hello"', () => {
      expect(ValueSerializer.deserialize('S:hello')).toBe('hello')
    })

    it('deserializes string with colons', () => {
      expect(ValueSerializer.deserialize('S:a:b:c')).toBe('a:b:c')
    })

    it('throws for missing colon', () => {
      expect(() => ValueSerializer.deserialize('invalid')).toThrow()
    })

    it('throws for unknown type prefix', () => {
      expect(() => ValueSerializer.deserialize('X:value')).toThrow()
    })
  })

  describe('round-trip', () => {
    const cases = [null, 0, 42, -100, 'text', 'with:colons', '']

    for (const value of cases) {
      it(`round-trips ${JSON.stringify(value)}`, () => {
        const serialized = ValueSerializer.serialize(value)
        const deserialized = ValueSerializer.deserialize(serialized)
        expect(deserialized).toEqual(value ?? null)
      })
    }
  })
})
