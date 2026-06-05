'use client'

type AppLoaderSize = 'sm' | 'md' | 'lg'

const sizeClass: Record<AppLoaderSize, string> = {
	sm: 'h-8 w-8',
	md: 'h-12 w-12',
	lg: 'h-16 w-16',
}

type Props = {
	className?: string
	size?: AppLoaderSize
	label?: string
	fullScreen?: boolean
}

export default function AppLoader({
	className = '',
	size = 'md',
	label,
	fullScreen = false,
}: Props) {
	const content = (
		<div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
			<div
				className={`${sizeClass[size]} relative shrink-0`}
				aria-hidden
			>
				<div className='absolute inset-0 rounded-full border-2 border-white/10' />
				<div
					className='absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-white border-r-white/60'
					style={{ animationDuration: '0.8s' }}
				/>
				<div
					className='absolute inset-[15%] animate-spin rounded-full border-2 border-transparent border-b-white/80 border-l-white/30'
					style={{ animationDuration: '1.2s', animationDirection: 'reverse' }}
				/>
			</div>
			{label ? <p className='text-sm text-gray-400'>{label}</p> : null}
		</div>
	)

	if (fullScreen) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-black'>
				{content}
			</div>
		)
	}

	return content
}
