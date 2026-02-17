const DEFAULTS = {
	enabled: false,
	host: '127.0.0.1',
	port: 9000,
	apiKey: '',
	domains: '',
}

function byId(id) {
	return document.getElementById(id)
}

async function loadSettings() {
	const settings = await chrome.storage.local.get(DEFAULTS)
	byId('enabled').checked = settings.enabled
	byId('host').value = settings.host
	byId('port').value = String(settings.port)
	byId('apiKey').value = settings.apiKey
	byId('domains').value = settings.domains
}

async function saveSettings() {
	const enabled = byId('enabled').checked
	const host = byId('host').value.trim() || DEFAULTS.host
	const port = Number(byId('port').value || DEFAULTS.port)
	const apiKey = byId('apiKey').value.trim()
	const domains = byId('domains').value.trim()

	await chrome.storage.local.set({
		enabled,
		host,
		port,
		apiKey,
		domains,
	})

	const status = byId('status')
	status.textContent = 'Сохранено'
	chrome.runtime.sendMessage({ type: 'apply' }, () => {})
	setTimeout(() => {
		status.textContent = ''
	}, 1500)
}

document.addEventListener('DOMContentLoaded', () => {
	loadSettings()
	byId('save').addEventListener('click', saveSettings)
})
