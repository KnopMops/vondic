import { AuthProvider } from '@/lib/AuthContext'
import ReactQueryProvider from '@/lib/ReactQueryProvider'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
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
	title: 'Vondic',
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
				<StoreProvider>
					<ReactQueryProvider>
						<AuthProvider>{children}</AuthProvider>
					</ReactQueryProvider>
				</StoreProvider>
			</body>
		</html>
	)
}
