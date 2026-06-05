'use client'

import { FiEye as Eye, FiEyeOff as EyeOff } from 'react-icons/fi'
import { InputHTMLAttributes, useState } from 'react'

type PasswordInputProps = Omit<
	InputHTMLAttributes<HTMLInputElement>,
	'type'
> & {
	wrapperClassName?: string
}

export default function PasswordInput({
	className = '',
	wrapperClassName = '',
	...props
}: PasswordInputProps) {
	const [visible, setVisible] = useState(false)

	return (
		<div className={`relative ${wrapperClassName}`}>
			<input
				{...props}
				type={visible ? 'text' : 'password'}
				className={`${className} ${props.disabled ? '' : 'pr-11'}`}
			/>
			<button
				type='button'
				tabIndex={-1}
				aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
				onClick={() => setVisible(v => !v)}
				className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-0.5'
			>
				{visible ? (
					<EyeOff className='w-4 h-4' />
				) : (
					<Eye className='w-4 h-4' />
				)}
			</button>
		</div>
	)
}
