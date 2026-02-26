import { describe, it, expect } from 'vitest'
import { EntityId } from './EntityId'
import { InvalidEntityIdError } from '../errors'

describe('EntityId', () => {
  describe('create', () => {
    it('should generate a valid UUID', () => {
      const id = EntityId.create()
      expect(EntityId.isValid(id.toString())).toBe(true)
    })

    it('should generate unique UUIDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(EntityId.create().toString())
      }
      expect(ids.size).toBe(100)
    })
  })

  describe('fromString', () => {
    it('should create from valid UUID string', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const id = EntityId.fromString(uuid)
      expect(id.toString()).toBe(uuid)
    })

    it('should normalize to lowercase', () => {
      const uuid = '550E8400-E29B-41D4-A716-446655440000'
      const id = EntityId.fromString(uuid)
      expect(id.toString()).toBe(uuid.toLowerCase())
    })

    it('should throw error for invalid UUID format', () => {
      expect(() => EntityId.fromString('invalid')).toThrow(InvalidEntityIdError)
      expect(() => EntityId.fromString('')).toThrow(InvalidEntityIdError)
      expect(() => EntityId.fromString('550e8400-e29b-41d4-a716')).toThrow(
        InvalidEntityIdError
      )
    })

    it('should throw error for UUID with invalid characters', () => {
      expect(() =>
        EntityId.fromString('550e8400-e29b-41d4-a716-44665544000g')
      ).toThrow(InvalidEntityIdError)
    })
  })

  describe('isValid', () => {
    it('should return true for valid UUIDs', () => {
      expect(EntityId.isValid('550e8400-e29b-41d4-a716-446655440000')).toBe(
        true
      )
      expect(EntityId.isValid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
        true
      )
    })

    it('should return false for invalid UUIDs', () => {
      expect(EntityId.isValid('invalid')).toBe(false)
      expect(EntityId.isValid('')).toBe(false)
      expect(EntityId.isValid('550e8400-e29b-41d4-a716')).toBe(false)
      expect(EntityId.isValid('550e8400e29b41d4a716446655440000')).toBe(false)
    })
  })

  describe('equals', () => {
    it('should return true for equal IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const id1 = EntityId.fromString(uuid)
      const id2 = EntityId.fromString(uuid)
      expect(id1.equals(id2)).toBe(true)
    })

    it('should return true for same ID with different case', () => {
      const id1 = EntityId.fromString('550e8400-e29b-41d4-a716-446655440000')
      const id2 = EntityId.fromString('550E8400-E29B-41D4-A716-446655440000')
      expect(id1.equals(id2)).toBe(true)
    })

    it('should return false for different IDs', () => {
      const id1 = EntityId.fromString('550e8400-e29b-41d4-a716-446655440000')
      const id2 = EntityId.fromString('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
      expect(id1.equals(id2)).toBe(false)
    })
  })

  describe('toString', () => {
    it('should return the UUID string', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const id = EntityId.fromString(uuid)
      expect(id.toString()).toBe(uuid)
    })
  })
})
