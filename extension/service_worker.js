const DEFAULTS = {
	darkTheme: true,
	compactMode: false,
	primaryColor: '#4f46e5',
	accentColor: '#ec4899',
	fontSize: 14,
	hideAvatars: false,
	hideNotifications: false,
}

async function getSettings() {
	const stored = await chrome.storage.local.get(DEFAULTS)
	return { ...DEFAULTS, ...stored }
}

function generateCustomCSS(settings) {
	const rules = []
	
	if (settings.darkTheme) {
		rules.push(`
			:root {
				--bg-primary: #0b0f14;
				--bg-secondary: #1a1f2e;
				--text-primary: #f5f5f5;
				--text-secondary: #9ca3af;
			}
		`)
	}
	
	if (settings.compactMode) {
		rules.push(`
			* {
				line-height: 1.4 !important;
			}
			[class*="post"], [class*="card"], [class*="item"] {
				padding: 8px !important;
				margin-bottom: 8px !important;
			}
			[class*="avatar"] {
				width: 32px !important;
				height: 32px !important;
			}
		`)
	}
	
	if (settings.primaryColor !== '#4f46e5') {
		rules.push(`
			:root {
				--primary-color: ${settings.primaryColor};
			}
			[class*="primary"], [class*="indigo"] {
				background-color: ${settings.primaryColor} !important;
			}
		`)
	}
	
	if (settings.accentColor !== '#ec4899') {
		rules.push(`
			:root {
				--accent-color: ${settings.accentColor};
			}
		`)
	}
	
	if (settings.fontSize !== 14) {
		rules.push(`
			body {
				font-size: ${settings.fontSize}px !important;
			}
		`)
	}
	
	if (settings.hideAvatars) {
		rules.push(`
			[class*="avatar"], [class*="profile-pic"] {
				display: none !important;
			}
		`)
	}
	
	if (settings.hideNotifications) {
		rules.push(`
			[class*="notification"], [class*="toast"], [class*="alert"] {
				display: none !important;
			}
		`)
	}
	
	return rules.join('\n')
}

async function applyCustomization(settings) {
	if (!settings) {
		settings = await getSettings()
	}
	
	const css = generateCustomCSS(settings)
	
	// Inject CSS into all tabs
	const tabs = await chrome.tabs.query({})
	for (const tab of tabs) {
		try {
			await chrome.scripting.insertCSS({
				target: { tabId: tab.id },
				css,
				origin: 'USER',
			})
		} catch (e) {
			// Tab might not support CSS injection
		}
	}
}

chrome.runtime.onInstalled.addListener(() => {
	applyCustomization()
})

chrome.runtime.onStartup.addListener(() => {
	applyCustomization()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message && message.type === 'apply') {
		applyCustomization(message.settings).then(() => sendResponse({ ok: true }))
		return true
	}
	if (message && message.type === 'reset') {
		applyCustomization().then(() => sendResponse({ ok: true }))
		return true
	}
	return false
})
