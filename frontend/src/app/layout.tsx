import { GlobalCallUI, WebRTCProvider } from '@/components/calls'
import NotificationBell from '@/components/notifications/NotificationBell'
import GlobalPlayer from '@/components/music/GlobalPlayer'
import { UrlFallbackProvider } from '@/components/UrlFallbackProvider'
import { AuthProvider } from '@/lib/AuthContext'
import ReactQueryProvider from '@/lib/ReactQueryProvider'
import { SocketProvider } from '@/lib/SocketContext'
import { ToastProvider } from '@/lib/ToastContext'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import ThemeInit from '@/components/ThemeInit'
import '../styles/calls.css'
import './globals.css'
import StoreProvider from './StoreProvider'

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
})

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
})

export const metadata: Metadata = {
	title: 'Вондик',
	description: 'Универсальный коммуникационный хаб',
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang='ru'>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<ThemeInit />
				<UrlFallbackProvider>
					<StoreProvider>
						<ReactQueryProvider>
							<AuthProvider>
								<SocketProvider>
									<ToastProvider>
										<WebRTCProvider>
											{children}
											<GlobalCallUI />
											<GlobalPlayer />
											<NotificationBell />
										</WebRTCProvider>
									</ToastProvider>
								</SocketProvider>
							</AuthProvider>
						</ReactQueryProvider>
					</StoreProvider>
				</UrlFallbackProvider>
			</body>
		</html>
	)
}
