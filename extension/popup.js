const DEFAULTS = {
	darkTheme: true,
	compactMode: false,
	primaryColor: '#4f46e5',
	accentColor: '#ec4899',
	fontSize: 14,
	hideAvatars: false,
	hideNotifications: false,
}

function byId(id) {
	return document.getElementById(id)
}

async function loadSettings() {
	const stored = await chrome.storage.local.get(DEFAULTS)
	const settings = { ...DEFAULTS, ...stored }
	
	byId('darkTheme').checked = settings.darkTheme
	byId('compactMode').checked = settings.compactMode
	byId('primaryColor').value = settings.primaryColor
	byId('accentColor').value = settings.accentColor
	byId('fontSize').value = String(settings.fontSize)
	byId('fontSizeValue').textContent = `${settings.fontSize}px`
	byId('hideAvatars').checked = settings.hideAvatars
	byId('hideNotifications').checked = settings.hideNotifications
}

async function saveSettings() {
	const settings = {
		darkTheme: byId('darkTheme').checked,
		compactMode: byId('compactMode').checked,
		primaryColor: byId('primaryColor').value,
		accentColor: byId('accentColor').value,
		fontSize: Number(byId('fontSize').value),
		hideAvatars: byId('hideAvatars').checked,
		hideNotifications: byId('hideNotifications').checked,
	}

	await chrome.storage.local.set(settings)
	
	const status = byId('status')
	status.textContent = 'Настройки применены!'
	
	// Apply styles to current page
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
	if (tab) {
		await chrome.tabs.sendMessage(tab.id, { type: 'apply', settings })
	}
	
	setTimeout(() => {
		status.textContent = ''
	}, 2000)
}

async function resetSettings() {
	await chrome.storage.local.set(DEFAULTS)
	loadSettings()
	
	const status = byId('status')
	status.textContent = 'Настройки сброшены!'
	
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
	if (tab) {
		await chrome.tabs.sendMessage(tab.id, { type: 'reset' })
	}
	
	setTimeout(() => {
		status.textContent = ''
	}, 2000)
}

document.addEventListener('DOMContentLoaded', () => {
	loadSettings()
	byId('apply').addEventListener('click', saveSettings)
	byId('reset').addEventListener('click', resetSettings)
	
	// Update font size value display
	byId('fontSize').addEventListener('input', (e) => {
		byId('fontSizeValue').textContent = `${e.target.value}px`
	})
})
