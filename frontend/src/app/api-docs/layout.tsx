import { GlobalCallUI, WebRTCProvider } from '@/components/calls'
import NotificationBell from '@/components/notifications/NotificationBell'
import { AuthProvider } from '@/lib/AuthContext'
import ReactQueryProvider from '@/lib/ReactQueryProvider'
import { SocketProvider } from '@/lib/SocketContext'
import { ToastProvider } from '@/lib/ToastContext'
import { Geist, Geist_Mono } from 'next/font/google'
import React from 'react'
import '../globals.css'
import StoreProvider from '../StoreProvider'

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
})

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
})

export default function ApiDocsLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
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
			</body>
		</html>
	)
}