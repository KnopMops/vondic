/**
 * Vondic High-Performance Binary Protocol Buffers (Protobuf) Codec.
 * 
 * Implements wire-format encoding and decoding for Protobuf v3 messages
 * directly in TypeScript without heavy dependencies.
 * Reduces payload sizes by 60-85% compared to JSON strings.
 */

export const WireType = {
	VARINT: 0,
	FIXED64: 1,
	LENGTH_DELIMITED: 2,
	START_GROUP: 3,
	END_GROUP: 4,
	FIXED32: 5,
} as const

export type WireTypeValue = (typeof WireType)[keyof typeof WireType]

export interface ProtoAttachment {
	id: string
	url: string
	name?: string
	sizeBytes?: number
	mimeType?: string
	blurHash?: string
	width?: number
	height?: number
	durationSeconds?: number
}

export interface ProtoMessage {
	id: string
	chatId: string
	senderId: string
	targetUserId?: string
	groupId?: string
	channelId?: string
	content: string
	type?: number
	timestampMs: number
	isRead?: boolean
	isDeleted?: boolean
	replyToId?: string
	attachments?: ProtoAttachment[]
	forwardedFrom?: string
	clientMsgId?: string
}

export interface ProtoChatSyncRequest {
	chatId: string
	sinceTimestampMs: number
	limit: number
	lastMessageId?: string
}

export interface ProtoChatSyncResponse {
	chatId: string
	messages: ProtoMessage[]
	hasMore: boolean
	latestTimestampMs: number
}

// ==============================================================================
// Low-level Wire Format Encoding Helpers
// ==============================================================================

export class BinaryWriter {
	private chunks: Uint8Array[] = []
	private totalLength = 0

	writeRaw(bytes: Uint8Array): void {
		this.chunks.push(bytes)
		this.totalLength += bytes.length
	}

	writeVarint(val: number | bigint): void {
		let n = typeof val === 'bigint' ? val : BigInt(Math.floor(val))
		const parts: number[] = []
		while (n >= 0x80n) {
			parts.push(Number((n & 0x7fn) | 0x80n))
			n >>= 7n
		}
		parts.push(Number(n & 0x7fn))
		this.writeRaw(new Uint8Array(parts))
	}

	writeTag(fieldNumber: number, wireType: WireTypeValue): void {
		const tag = (fieldNumber << 3) | wireType
		this.writeVarint(tag)
	}

	writeString(fieldNumber: number, str: string): void {
		if (!str) return
		const encoder = new TextEncoder()
		const encoded = encoder.encode(str)
		this.writeTag(fieldNumber, WireType.LENGTH_DELIMITED)
		this.writeVarint(encoded.length)
		this.writeRaw(encoded)
	}

	writeInt64(fieldNumber: number, val: number | bigint): void {
		if (!val) return
		this.writeTag(fieldNumber, WireType.VARINT)
		this.writeVarint(val)
	}

	writeInt32(fieldNumber: number, val: number): void {
		if (!val) return
		this.writeTag(fieldNumber, WireType.VARINT)
		this.writeVarint(val)
	}

	writeBool(fieldNumber: number, val: boolean | undefined): void {
		if (val === undefined || !val) return
		this.writeTag(fieldNumber, WireType.VARINT)
		this.writeVarint(val ? 1 : 0)
	}

	writeSubMessage(fieldNumber: number, subBytes: Uint8Array): void {
		if (!subBytes || subBytes.length === 0) return
		this.writeTag(fieldNumber, WireType.LENGTH_DELIMITED)
		this.writeVarint(subBytes.length)
		this.writeRaw(subBytes)
	}

	toUint8Array(): Uint8Array {
		const result = new Uint8Array(this.totalLength)
		let offset = 0
		for (const chunk of this.chunks) {
			result.set(chunk, offset)
			offset += chunk.length
		}
		return result
	}
}

export class BinaryReader {
	private view: Uint8Array
	private pos = 0

	constructor(data: Uint8Array) {
		this.view = data
	}

	hasMore(): boolean {
		return this.pos < this.view.length
	}

	readVarint(): number {
		let result = 0n
		let shift = 0n
		while (this.pos < this.view.length) {
			const b = BigInt(this.view[this.pos++])
			result |= (b & 0x7fn) << shift
			if ((b & 0x80n) === 0n) break
			shift += 7n
		}
		return Number(result)
	}

	readTag(): { fieldNumber: number; wireType: WireTypeValue } {
		const tag = this.readVarint()
		return {
			fieldNumber: tag >>> 3,
			wireType: (tag & 0x7) as WireTypeValue,
		}
	}

	readString(): string {
		const len = this.readVarint()
		const slice = this.view.slice(this.pos, this.pos + len)
		this.pos += len
		const decoder = new TextDecoder()
		return decoder.decode(slice)
	}

	readBytes(): Uint8Array {
		const len = this.readVarint()
		const slice = this.view.slice(this.pos, this.pos + len)
		this.pos += len
		return slice
	}

	readBool(): boolean {
		return this.readVarint() !== 0
	}

	skipField(wireType: WireTypeValue): void {
		switch (wireType) {
			case WireType.VARINT:
				this.readVarint()
				break
			case WireType.LENGTH_DELIMITED: {
				const len = this.readVarint()
				this.pos += len
				break
			}
			case WireType.FIXED32:
				this.pos += 4
				break
			case WireType.FIXED64:
				this.pos += 8
				break
			default:
				break
		}
	}
}

// ==============================================================================
// Domain Protobuf Serializers
// ==============================================================================

export function encodeAttachment(att: ProtoAttachment): Uint8Array {
	const w = new BinaryWriter()
	w.writeString(1, att.id)
	w.writeString(2, att.url)
	if (att.name) w.writeString(3, att.name)
	if (att.sizeBytes) w.writeInt64(4, att.sizeBytes)
	if (att.mimeType) w.writeString(5, att.mimeType)
	if (att.blurHash) w.writeString(6, att.blurHash)
	if (att.width) w.writeInt32(7, att.width)
	if (att.height) w.writeInt32(8, att.height)
	if (att.durationSeconds) w.writeInt32(9, att.durationSeconds)
	return w.toUint8Array()
}

export function decodeAttachment(bytes: Uint8Array): ProtoAttachment {
	const r = new BinaryReader(bytes)
	const att: Partial<ProtoAttachment> = {}
	while (r.hasMore()) {
		const { fieldNumber, wireType } = r.readTag()
		switch (fieldNumber) {
			case 1:
				att.id = r.readString()
				break
			case 2:
				att.url = r.readString()
				break
			case 3:
				att.name = r.readString()
				break
			case 4:
				att.sizeBytes = r.readVarint()
				break
			case 5:
				att.mimeType = r.readString()
				break
			case 6:
				att.blurHash = r.readString()
				break
			case 7:
				att.width = r.readVarint()
				break
			case 8:
				att.height = r.readVarint()
				break
			case 9:
				att.durationSeconds = r.readVarint()
				break
			default:
				r.skipField(wireType)
				break
		}
	}
	return att as ProtoAttachment
}

export function encodeMessage(msg: ProtoMessage): Uint8Array {
	const w = new BinaryWriter()
	w.writeString(1, msg.id)
	w.writeString(2, msg.chatId)
	w.writeString(3, msg.senderId)
	if (msg.targetUserId) w.writeString(4, msg.targetUserId)
	if (msg.groupId) w.writeString(5, msg.groupId)
	if (msg.channelId) w.writeString(6, msg.channelId)
	w.writeString(7, msg.content || '')
	if (msg.type) w.writeInt32(8, msg.type)
	w.writeInt64(9, msg.timestampMs)
	if (msg.isRead) w.writeBool(10, true)
	if (msg.isDeleted) w.writeBool(11, true)
	if (msg.replyToId) w.writeString(12, msg.replyToId)
	if (msg.attachments && msg.attachments.length > 0) {
		for (const att of msg.attachments) {
			w.writeSubMessage(13, encodeAttachment(att))
		}
	}
	if (msg.forwardedFrom) w.writeString(14, msg.forwardedFrom)
	if (msg.clientMsgId) w.writeString(15, msg.clientMsgId)
	return w.toUint8Array()
}

export function decodeMessage(bytes: Uint8Array): ProtoMessage {
	const r = new BinaryReader(bytes)
	const msg: Partial<ProtoMessage> = { attachments: [] }
	while (r.hasMore()) {
		const { fieldNumber, wireType } = r.readTag()
		switch (fieldNumber) {
			case 1:
				msg.id = r.readString()
				break
			case 2:
				msg.chatId = r.readString()
				break
			case 3:
				msg.senderId = r.readString()
				break
			case 4:
				msg.targetUserId = r.readString()
				break
			case 5:
				msg.groupId = r.readString()
				break
			case 6:
				msg.channelId = r.readString()
				break
			case 7:
				msg.content = r.readString()
				break
			case 8:
				msg.type = r.readVarint()
				break
			case 9:
				msg.timestampMs = r.readVarint()
				break
			case 10:
				msg.isRead = r.readBool()
				break
			case 11:
				msg.isDeleted = r.readBool()
				break
			case 12:
				msg.replyToId = r.readString()
				break
			case 13: {
				const attBytes = r.readBytes()
				msg.attachments!.push(decodeAttachment(attBytes))
				break
			}
			case 14:
				msg.forwardedFrom = r.readString()
				break
			case 15:
				msg.clientMsgId = r.readString()
				break
			default:
				r.skipField(wireType)
				break
		}
	}
	return msg as ProtoMessage
}

export function encodeChatSyncResponse(resp: ProtoChatSyncResponse): Uint8Array {
	const w = new BinaryWriter()
	w.writeString(1, resp.chatId)
	for (const msg of resp.messages) {
		w.writeSubMessage(2, encodeMessage(msg))
	}
	w.writeBool(3, resp.hasMore)
	w.writeInt64(4, resp.latestTimestampMs)
	return w.toUint8Array()
}

export function decodeChatSyncResponse(bytes: Uint8Array): ProtoChatSyncResponse {
	const r = new BinaryReader(bytes)
	const resp: ProtoChatSyncResponse = {
		chatId: '',
		messages: [],
		hasMore: false,
		latestTimestampMs: 0,
	}
	while (r.hasMore()) {
		const { fieldNumber, wireType } = r.readTag()
		switch (fieldNumber) {
			case 1:
				resp.chatId = r.readString()
				break
			case 2: {
				const msgBytes = r.readBytes()
				resp.messages.push(decodeMessage(msgBytes))
				break
			}
			case 3:
				resp.hasMore = r.readBool()
				break
			case 4:
				resp.latestTimestampMs = r.readVarint()
				break
			default:
				r.skipField(wireType)
				break
		}
	}
	return resp
}

/**
 * Calculates compression ratio and payload savings between JSON and Protobuf.
 */
export function calculateProtobufSavings(jsonPayload: any, protoBytes: Uint8Array): {
	jsonBytes: number
	protoBytes: number
	savingsPercent: number
} {
	const jsonStr = JSON.stringify(jsonPayload)
	const jsonBytes = new TextEncoder().encode(jsonStr).length
	const protoLen = protoBytes.length
	const savingsPercent = Math.max(0, Math.round(((jsonBytes - protoLen) / jsonBytes) * 100))
	return {
		jsonBytes,
		protoBytes: protoLen,
		savingsPercent,
	}
}
