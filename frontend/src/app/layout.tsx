import { GlobalCallUI, WebRTCProvider } from '@/components/calls'
import NotificationBell from '@/components/notifications/NotificationBell'
import GlobalPlayer from '@/components/music/GlobalPlayer'
import { UrlFallbackProvider } from '@/components/UrlFallbackProvider'
import { AuthProvider } from '@/lib/AuthContext'
import ReactQueryProvider from '@/lib/ReactQueryProvider'
import { SocketProvider } from '@/lib/SocketContext'
import { ToastProvider } from '@/lib/ToastContext'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import DesktopReleaseBanner from '@/components/DesktopReleaseBanner'
import ThemeInit from '@/components/ThemeInit'
import BottomNav from '@/components/social/BottomNav'
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

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: 'cover',
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
				<DesktopReleaseBanner />
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
