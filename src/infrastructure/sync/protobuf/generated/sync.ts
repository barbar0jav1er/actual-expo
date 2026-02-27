/**
 * Hand-coded protobuf binary encoder/decoder for Actual Budget sync protocol.
 * Implements the wire format defined in sync.proto without a runtime dependency.
 *
 * Wire types:
 *   0 = varint
 *   2 = length-delimited (strings, bytes, nested messages, repeated)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProtoMessage {
  dataset: string
  row: string
  column: string
  value: string
}

export interface ProtoMessageEnvelope {
  timestamp: string
  isEncrypted: boolean
  content: Uint8Array
}

export interface ProtoSyncRequest {
  messages: ProtoMessageEnvelope[]
  fileId: string
  groupId: string
  keyId?: string
  since: string
}

export interface ProtoSyncResponse {
  messages: ProtoMessageEnvelope[]
  merkle: string
}

// ─── Low-level encoding ────────────────────────────────────────────────────────

const WIRE_VARINT = 0
const WIRE_LENGTH_DELIMITED = 2

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encodeVarint(value: number): number[] {
  const bytes: number[] = []
  let v = value >>> 0 // treat as unsigned 32-bit
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80)
    v >>>= 7
  }
  bytes.push(v & 0x7f)
  return bytes
}

function encodeTag(fieldNumber: number, wireType: number): number[] {
  return encodeVarint((fieldNumber << 3) | wireType)
}

function encodeLengthDelimited(fieldNumber: number, data: Uint8Array): number[] {
  return [
    ...encodeTag(fieldNumber, WIRE_LENGTH_DELIMITED),
    ...encodeVarint(data.length),
    ...data,
  ]
}

function encodeStringField(fieldNumber: number, str: string): number[] {
  if (!str) return []
  return encodeLengthDelimited(fieldNumber, encoder.encode(str))
}

function encodeBytesField(fieldNumber: number, data: Uint8Array): number[] {
  if (!data.length) return []
  return encodeLengthDelimited(fieldNumber, data)
}

function encodeBoolField(fieldNumber: number, value: boolean): number[] {
  if (!value) return []
  return [...encodeTag(fieldNumber, WIRE_VARINT), ...encodeVarint(1)]
}

function concat(parts: number[][]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const buf = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    buf.set(part, offset)
    offset += part.length
  }
  return buf
}

// ─── Low-level decoding ────────────────────────────────────────────────────────

class Reader {
  pos = 0

  constructor(private readonly buf: Uint8Array) {}

  get remaining(): number {
    return this.buf.length - this.pos
  }

  readVarint(): number {
    let value = 0
    let shift = 0
    while (true) {
      const byte = this.buf[this.pos++]
      value |= (byte & 0x7f) << shift
      if ((byte & 0x80) === 0) break
      shift += 7
    }
    return value >>> 0
  }

  readBytes(): Uint8Array {
    const len = this.readVarint()
    const data = this.buf.slice(this.pos, this.pos + len)
    this.pos += len
    return data
  }

  readString(): string {
    return decoder.decode(this.readBytes())
  }

  readBool(): boolean {
    return this.readVarint() !== 0
  }

  skipField(wireType: number): void {
    switch (wireType) {
      case WIRE_VARINT:
        this.readVarint()
        break
      case WIRE_LENGTH_DELIMITED:
        this.readBytes()
        break
      default:
        throw new Error(`Unsupported wire type: ${wireType}`)
    }
  }

  readTag(): [number, number] {
    const tag = this.readVarint()
    return [tag >>> 3, tag & 0x7]
  }
}

// ─── Message encoding/decoding ─────────────────────────────────────────────────

export function encodeMessage(msg: ProtoMessage): Uint8Array {
  return concat([
    encodeStringField(1, msg.dataset),
    encodeStringField(2, msg.row),
    encodeStringField(3, msg.column),
    encodeStringField(4, msg.value),
  ])
}

export function decodeMessage(buf: Uint8Array): ProtoMessage {
  const r = new Reader(buf)
  const msg: ProtoMessage = { dataset: '', row: '', column: '', value: '' }
  while (r.remaining > 0) {
    const [field, wire] = r.readTag()
    switch (field) {
      case 1: msg.dataset = r.readString(); break
      case 2: msg.row = r.readString(); break
      case 3: msg.column = r.readString(); break
      case 4: msg.value = r.readString(); break
      default: r.skipField(wire)
    }
  }
  return msg
}

export function encodeMessageEnvelope(env: ProtoMessageEnvelope): Uint8Array {
  return concat([
    encodeStringField(1, env.timestamp),
    encodeBoolField(2, env.isEncrypted),
    encodeBytesField(3, env.content),
  ])
}

export function decodeMessageEnvelope(buf: Uint8Array): ProtoMessageEnvelope {
  const r = new Reader(buf)
  const env: ProtoMessageEnvelope = {
    timestamp: '',
    isEncrypted: false,
    content: new Uint8Array(0),
  }
  while (r.remaining > 0) {
    const [field, wire] = r.readTag()
    switch (field) {
      case 1: env.timestamp = r.readString(); break
      case 2: env.isEncrypted = r.readBool(); break
      case 3: env.content = r.readBytes(); break
      default: r.skipField(wire)
    }
  }
  return env
}

export function encodeSyncRequest(req: ProtoSyncRequest): Uint8Array {
  const parts: number[][] = []

  for (const envelope of req.messages) {
    const encoded = encodeMessageEnvelope(envelope)
    parts.push(encodeLengthDelimited(1, encoded))
  }

  parts.push(encodeStringField(2, req.fileId))
  parts.push(encodeStringField(3, req.groupId))
  if (req.keyId) parts.push(encodeStringField(5, req.keyId))
  parts.push(encodeStringField(6, req.since))

  return concat(parts)
}

export function decodeSyncResponse(buf: Uint8Array): ProtoSyncResponse {
  const r = new Reader(buf)
  const res: ProtoSyncResponse = { messages: [], merkle: '' }

  while (r.remaining > 0) {
    const [field, wire] = r.readTag()
    switch (field) {
      case 1:
        res.messages.push(decodeMessageEnvelope(r.readBytes()))
        break
      case 2:
        res.merkle = r.readString()
        break
      default:
        r.skipField(wire)
    }
  }

  return res
}
