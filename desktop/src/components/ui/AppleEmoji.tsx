'use client'

import { Emoji, EmojiStyle } from 'emoji-picker-react'

function emojiToUnified(emoji: string): string {
	// emoji-picker-react expects "unified" like "1f600" or "1f468-200d-1f4bb"
	const codepoints: number[] = []
	for (const ch of Array.from(emoji)) {
		const cp = ch.codePointAt(0)
		if (typeof cp === 'number') codepoints.push(cp)
	}
	// Drop variation selector-16 so we don't get mismatches (most emoji data is normalized without it)
	const normalized = codepoints.filter(cp => cp !== 0xfe0f)
	return normalized.map(cp => cp.toString(16)).join('-')
}

export function AppleEmoji({
	emoji,
	size = 22,
	className,
}: {
	emoji: string
	size?: number
	className?: string
}) {
	return (
		<span className={className} aria-label={emoji}>
			<Emoji unified={emojiToUnified(emoji)} emojiStyle={EmojiStyle.APPLE} size={size} />
		</span>
	)
}

