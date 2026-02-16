import { GlobalCallUI, WebRTCProvider } from '@/components/calls'
import { AuthProvider } from '@/lib/AuthContext'
import ReactQueryProvider from '@/lib/ReactQueryProvider'
import { SocketProvider } from '@/lib/SocketContext'
import { ToastProvider } from '@/lib/ToastContext'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import '../styles/calls.css'
import './globals.css'
import StoreProvider from './StoreProvider'
import NotificationBell from '@/components/notifications/NotificationBell'

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
})

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
})

export const metadata: Metadata = {
	title: 'Vondic',
	description: 'Универсальный коммуникационный хаб',
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const privacyUrl = `${
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
	}/static/privacy_policy.rtf`
	return (
		<html lang='ru'>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<StoreProvider>
					<ReactQueryProvider>
						<AuthProvider>
							<SocketProvider>
								<ToastProvider>
									<WebRTCProvider>
										{children}
										<GlobalCallUI />
										<NotificationBell />
									</WebRTCProvider>
								</ToastProvider>
							</SocketProvider>
						</AuthProvider>
					</ReactQueryProvider>
				</StoreProvider>
				<div className='fixed inset-x-0 bottom-3 z-40 flex justify-center px-4'>
					<p className='text-center text-xs text-gray-500'>
						Политика конфиденциальности:{' '}
						<a
							href={privacyUrl}
							target='_blank'
							rel='noopener noreferrer'
							className='text-indigo-400 hover:text-indigo-300 transition-colors'
						>
							ссылка
						</a>
					</p>
				</div>
			</body>
		</html>
	)
}
