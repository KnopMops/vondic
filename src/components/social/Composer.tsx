'use client'

import { useState } from 'react'

type Props = {
	onCreate: (text: string) => void
}

export default function Composer({ onCreate }: Props) {
	const [text, setText] = useState('')

	const submit = () => {
		if (!text.trim()) return
		onCreate(text.trim())
		setText('')
	}

	return (
		<div className='rounded-xl bg-gray-900/40 backdrop-blur-md border border-gray-800/50 p-4 shadow-sm'>
			<input
				value={text}
				onChange={e => setText(e.target.value)}
				placeholder='Что у вас нового?'
				className='w-full rounded-xl border border-gray-700/50 bg-gray-800/50 px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all'
			/>
			<div className='mt-3 flex items-center gap-3'>
				<button
					onClick={submit}
					className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20'
				>
					Опубликовать
				</button>
				<button className='rounded-lg bg-gray-800/50 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors'>
					Фото
				</button>
				<button className='rounded-lg bg-gray-800/50 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors'>
					Видео
				</button>
			</div>
		</div>
	)
}
