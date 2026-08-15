import { GlobalCallUI, WebRTCProvider } from '@/components/calls'
import CookieConsent from '@/components/CookieConsent'
import DesktopReleaseBanner from '@/components/DesktopReleaseBanner'
import GlobalPlayer from '@/components/music/GlobalPlayer'
import NotificationBell from '@/components/notifications/NotificationBell'
import ErrorBoundary from '@/components/ErrorBoundary'
import SupportWidget from '@/components/support/SupportWidget'
import ThemeInit from '@/components/ThemeInit'
import { UrlFallbackProvider } from '@/components/UrlFallbackProvider'
import { AuthProvider } from '@/lib/AuthContext'
import ReactQueryProvider from '@/lib/ReactQueryProvider'
import { SocialCommunitiesProvider } from '@/lib/SocialCommunitiesContext'
import { SocketProvider } from '@/lib/SocketContext'
import { ToastProvider } from '@/lib/ToastContext'
import type { Metadata, Viewport } from 'next'
import '../styles/calls.css'
import './globals.css'
import StoreProvider from './StoreProvider'
import PushRegistrar from '@/components/PushRegistrar'
import IosPushBanner from '@/components/IosPushBanner'

const geistSans = { variable: '--font-geist-sans' }
const geistMono = { variable: '--font-geist-mono' }

export const metadata: Metadata = {
	title: 'Вондик — Коммуникационный хаб',
	description: 'Универсальный коммуникационный хаб: чаты, видео и аудио звонки WebRTC, сообщества',
	manifest: '/manifest.webmanifest',
	appleWebApp: {
		capable: true,
		statusBarStyle: 'black-translucent',
		title: 'Вондик',
	},
	icons: {
		icon: '/favicon.ico',
		apple: '/logo.png',
	},
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
								<PushRegistrar />
								<IosPushBanner />
								<SocialCommunitiesProvider>
									<SocketProvider>
										<ToastProvider>
											<WebRTCProvider>
												{children}
											<GlobalCallUI />
											<GlobalPlayer />
											<ErrorBoundary>
												<NotificationBell />
											</ErrorBoundary>
											<ErrorBoundary>
												<SupportWidget />
											</ErrorBoundary>
											</WebRTCProvider>
											<CookieConsent />
										</ToastProvider>
									</SocketProvider>
								</SocialCommunitiesProvider>
							</AuthProvider>
						</ReactQueryProvider>
					</StoreProvider>
				</UrlFallbackProvider>
			</body>
		</html>
	)
}
