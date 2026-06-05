'use client'

import Link from 'next/link'
import React from 'react'
import { isVondicInviteUrl } from './inviteLinks'

const ENTITY_RE = new RegExp(
	[
		'(https?:\\/\\/[^\\s<>\\[\\]()]+[^\\s<>\\[\\]().,;:!?\\]])',
		'(www\\.[^\\s<>\\[\\]()]+)',
		'(@[a-zA-Z0-9_]{3,32})',
		'(#[\\w\\u0400-\\u04FF]+)',
		'(\\/feed\\/(?:messages\\/join(?:\\/(?:channel|group))?\\/[^\\s<]+|communities\\/join\\/[^\\s<]+))',
	].join('|'),
	'gi',
)

export function richLinkClass(isOwn?: boolean, isInvite?: boolean): string {
	if (isInvite) {
		return isOwn
			? 'text-emerald-200 hover:text-emerald-100 hover:underline cursor-pointer break-all'
			: 'text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer break-all'
	}
	return isOwn
		? 'text-sky-200 hover:text-sky-100 hover:underline cursor-pointer break-all'
		: 'text-[#6ab2f2] hover:underline cursor-pointer break-all'
}

function renderEntity(
	entity: string,
	key: string,
	isOwn?: boolean,
): React.ReactNode {
	if (/^https?:\/\//i.test(entity) || /^www\./i.test(entity)) {
		const href = entity.startsWith('www.') ? `https://${entity}` : entity
		const invite = isVondicInviteUrl(href)
		return (
			<a
				key={key}
				href={href}
				target='_blank'
				rel='noopener noreferrer'
				className={richLinkClass(isOwn, invite)}
			>
				{entity}
			</a>
		)
	}
	if (entity.startsWith('/feed/')) {
		const invite = isVondicInviteUrl(entity)
		return (
			<Link
				key={key}
				href={entity.split(/[?#]/)[0]}
				className={richLinkClass(isOwn, invite)}
			>
				{entity}
			</Link>
		)
	}
	if (entity.startsWith('@') || entity.startsWith('#')) {
		return (
			<span key={key} className={richLinkClass(isOwn)}>
				{entity}
			</span>
		)
	}
	return entity
}

export function renderRichInline(
	text: string,
	keyPrefix: string,
	isOwn?: boolean,
): React.ReactNode[] {
	const codeParts = text.split('`')
	const nodes: React.ReactNode[] = []

	codeParts.forEach((part, codeIndex) => {
		if (codeIndex % 2 === 1) {
			nodes.push(
				<code
					key={`${keyPrefix}-code-${codeIndex}`}
					className='rounded bg-black/30 px-1 text-[0.9em] font-mono text-emerald-200'
				>
					{part}
				</code>,
			)
			return
		}

		let lastIndex = 0
		const re = new RegExp(ENTITY_RE.source, 'gi')
		let match: RegExpExecArray | null
		while ((match = re.exec(part)) !== null) {
			const token = match[0]
			const idx = match.index
			if (idx > lastIndex) {
				nodes.push(
					<span key={`${keyPrefix}-t-${codeIndex}-${lastIndex}`}>
						{part.slice(lastIndex, idx)}
					</span>,
				)
			}
			nodes.push(renderEntity(token, `${keyPrefix}-e-${codeIndex}-${idx}`, isOwn))
			lastIndex = idx + token.length
		}
		if (lastIndex < part.length) {
			nodes.push(
				<span key={`${keyPrefix}-tail-${codeIndex}`}>
					{part.slice(lastIndex)}
				</span>,
			)
		}
	})

	return nodes
}

export function renderRichTextBlock(
	text: string,
	keyPrefix: string,
	isOwn?: boolean,
): React.ReactNode {
	const lines = text.split('\n')
	return (
		<div key={keyPrefix} className='break-words leading-relaxed'>
			{lines.map((line, index) => (
				<span key={`${keyPrefix}-line-${index}`}>
					{renderRichInline(line, `${keyPrefix}-inline-${index}`, isOwn)}
					{index < lines.length - 1 ? <br /> : null}
				</span>
			))}
		</div>
	)
}

export function renderRichFormattedContent(
	content: string,
	isOwn?: boolean,
): React.ReactNode[] {
	const blocks = content.split('```')
	return blocks.map((block, index) => {
		if (index % 2 === 1) {
			const firstNewline = block.indexOf('\n')
			const firstLine =
				firstNewline === -1 ? block.trim() : block.slice(0, firstNewline).trim()
			const hasLang =
				firstLine.length > 0 &&
				!firstLine.includes(' ') &&
				firstNewline !== -1
			const language = hasLang ? firstLine : ''
			const code = hasLang ? block.slice(firstNewline + 1) : block
			const codeText = code.replace(/\n$/, '')
			return (
				<div
					key={`code-${index}`}
					className='my-2 overflow-hidden rounded-lg border border-white/10 bg-black/30'
				>
					{language ? (
						<div className='border-b border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400'>
							{language}
						</div>
					) : null}
					<pre className='overflow-x-auto p-3 text-xs md:text-sm'>
						<code className='font-mono text-emerald-200'>{codeText}</code>
					</pre>
				</div>
			)
		}
		return block.trim()
			? renderRichTextBlock(block, `text-${index}`, isOwn)
			: null
	})
}
