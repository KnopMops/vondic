import Image from 'next/image'

export default function Logo({ className = 'w-9 h-9' }: { className?: string }) {
	return (
		<Image
			src='/favicon.ico'
			alt='Вондик'
			width={36}
			height={36}
			className={className}
			priority
		/>
	)
}
