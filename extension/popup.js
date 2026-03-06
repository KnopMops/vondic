const DEFAULTS = {
	enabled: false,
	host: '127.0.0.1',
	httpPort: 9000,
	httpsPort: 9000,
	apiKey: '',
	domains: '',
}

function byId(id) {
	return document.getElementById(id)
}

async function loadSettings() {
	const stored = await chrome.storage.local.get(DEFAULTS)
	const settings = { ...DEFAULTS, ...stored }
	const httpPort = settings.httpPort || settings.port || DEFAULTS.httpPort
	const httpsPort = settings.httpsPort || settings.port || DEFAULTS.httpsPort
	byId('host').value = settings.host
	byId('httpPort').value = String(httpPort)
	byId('httpsPort').value = String(httpsPort)
	byId('apiKey').value = settings.apiKey
	byId('domains').value = settings.domains
	const status = byId('status')
	status.textContent = settings.enabled ? 'Прокси включен' : 'Прокси выключен'
}

async function saveSettings() {
	const stored = await chrome.storage.local.get(DEFAULTS)
	const enabled = !stored.enabled
	const host = byId('host').value.trim() || DEFAULTS.host
	const httpPort = Number(byId('httpPort').value || DEFAULTS.httpPort)
	const httpsPort = Number(byId('httpsPort').value || DEFAULTS.httpsPort)
	const apiKey = byId('apiKey').value.trim()
	const domains = byId('domains').value.trim()

	await chrome.storage.local.set({
		enabled,
		host,
		httpPort,
		httpsPort,
		apiKey,
		domains,
	})

	const status = byId('status')
	status.textContent = enabled ? 'Прокси включен' : 'Прокси выключен'
	chrome.runtime.sendMessage({ type: 'apply' }, () => {})
	setTimeout(() => {
		status.textContent = ''
	}, 1500)
}

document.addEventListener('DOMContentLoaded', () => {
	loadSettings()
	byId('save').addEventListener('click', saveSettings)
})
