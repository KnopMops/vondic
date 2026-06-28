'use client'

import { useMemo } from 'react'

const DEFAULT_EMAIL_DOMAINS = [
	'vondic.ru',
	'yandex.ru',
	'ya.ru',
	'mail.ru',
	'inbox.ru',
	'bk.ru',
	'list.ru',
	'gmail.com',
	'outlook.com',
	'icloud.com',
	'proton.me',
]

function buildSuggestions(value: string, domains: string[]): string[] {
	const v = value.trim()
	if (!v) return []

	if (v.includes('@')) {
		const at = v.indexOf('@')
		const local = v.slice(0, at)
		const domainPart = v.slice(at + 1).toLowerCase()
		if (!local) return []
		return domains.filter(
			d => !domainPart || d.startsWith(domainPart),
		).map(d => `${local}@${d}`)
	}

	return domains.map(d => `${v}@${d}`)
}

type EmailInputProps = {
	id?: string
	name?: string
	value: string
	onChange: (value: string) => void
	placeholder?: string
	className?: string
	autoComplete?: string
	required?: boolean
	disabled?: boolean
	listId?: string
	domains?: string[]
}

export default function EmailInput({
	id = 'email',
	name = 'email',
	value,
	onChange,
	placeholder = 'Электронная почта',
	className = '',
	autoComplete = 'email',
	required,
	disabled,
	listId = 'vondic-email-suggestions',
	domains = DEFAULT_EMAIL_DOMAINS,
}: EmailInputProps) {
	const suggestions = useMemo(
		() => buildSuggestions(value, domains),
		[value, domains],
	)

	return (
		<>
			<input
				id={id}
				name={name}
				type="email"
				autoComplete={autoComplete}
				required={required}
				disabled={disabled}
				list={suggestions.length ? listId : undefined}
				className={className}
				placeholder={placeholder}
				value={value}
				onChange={e => onChange(e.target.value)}
				onBlur={e => onChange(e.target.value.trim())}
			/>
			{suggestions.length > 0 ? (
				<datalist id={listId}>
					{suggestions.map(s => (
						<option key={s} value={s} />
					))}
				</datalist>
			) : null}
		</>
	)
}
