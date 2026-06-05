export type DesktopDownloadSettings = {
	version: string
	github_release_url: string
	windows_download_url: string
	macos_download_url: string
	linux_download_url: string
	windows_available: boolean
	macos_available: boolean
	linux_available: boolean
}

export type MobileDownloadSettings = {
	version: string
	android_download_url: string
	ios_download_url: string
	android_available: boolean
	ios_available: boolean
}

export type AppDownloadsSettings = {
	desktop: DesktopDownloadSettings
	mobile: MobileDownloadSettings
}

export const DEFAULT_APP_DOWNLOADS: AppDownloadsSettings = {
	desktop: {
		version: 'v1.0.1',
		github_release_url:
			'https://github.com/KnopMops/vondic/releases/tag/vondic-desktop',
		windows_download_url:
			'https://github.com/KnopMops/vondic/releases/download/vondic-desktop/portable.zip',
		macos_download_url: '',
		linux_download_url: '',
		windows_available: true,
		macos_available: false,
		linux_available: false,
	},
	mobile: {
		version: '1.0.0',
		android_download_url: '',
		ios_download_url: '',
		android_available: false,
		ios_available: false,
	},
}

export async function fetchAppDownloads(): Promise<AppDownloadsSettings> {
	try {
		const res = await fetch('/api/v1/app-downloads', {
			cache: 'no-store',
		})
		if (!res.ok) return DEFAULT_APP_DOWNLOADS
		const data = await res.json()
		const d = data?.downloads
		if (!d?.desktop || !d?.mobile) return DEFAULT_APP_DOWNLOADS
		return {
			desktop: { ...DEFAULT_APP_DOWNLOADS.desktop, ...d.desktop },
			mobile: { ...DEFAULT_APP_DOWNLOADS.mobile, ...d.mobile },
		}
	} catch {
		return DEFAULT_APP_DOWNLOADS
	}
}
