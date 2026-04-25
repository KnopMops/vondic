import Link from 'next/link'
import { FiArrowLeft as ArrowLeft, FiSmartphone as Smartphone } from 'react-icons/fi'

export default function MobileDownloadPage() {
	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
			</div>

			<div className='relative z-10 mx-auto max-w-3xl px-6 py-16'>
				<Link
					href='/download'
					className='inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white'
				>
					<ArrowLeft className='h-4 w-4' />
					Назад к загрузкам
				</Link>

				<div className='mt-10 rounded-3xl bg-gray-900/40 border border-gray-800 p-8'>
					<div className='w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5'>
						<Smartphone className='h-7 w-7 text-emerald-300' />
					</div>
					<h1 className='text-2xl md:text-3xl font-bold'>Mobile версия</h1>
					<p className='mt-3 text-gray-400'>
						Страница готова. Ссылки на приложения появятся здесь.
					</p>
				</div>
			</div>
		</div>
	)
}
