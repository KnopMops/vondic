const DEFAULTS = {
	enabled: false,
	host: '127.0.0.1',
	httpPort: 9000,
	httpsPort: 9000,
	apiKey: '',
	domains: '',
}

async function getSettings() {
	const stored = await chrome.storage.local.get(DEFAULTS)
	const settings = { ...DEFAULTS, ...stored }
	if (!settings.httpPort && settings.port) {
		settings.httpPort = settings.port
	}
	if (!settings.httpsPort && settings.port) {
		settings.httpsPort = settings.port
	}
	return settings
}

function normalizeDomains(input) {
	return input
		.split(',')
		.map(part => part.trim())
		.filter(Boolean)
}

function buildPacScript(host, httpPort, httpsPort, domains) {
	const httpProxy = `PROXY ${host}:${httpPort}`
	const httpsProxy = `PROXY ${host}:${httpsPort}`
	if (domains.length === 0) {
		return `function FindProxyForURL(url, host) { if (url.substring(0, 6) === "https:") return "${httpsProxy}"; return "${httpProxy}"; }`
	}
	const domainChecks = domains
		.map(
			domain =>
				`if (dnsDomainIs(host, "${domain}")) { if (url.substring(0, 6) === "https:") return "${httpsProxy}"; return "${httpProxy}"; }`,
		)
		.join('')
	return `function FindProxyForURL(url, host) { ${domainChecks} return "DIRECT"; }`
}

async function applyProxySettings() {
	const settings = await getSettings()
	if (!settings.enabled) {
		await chrome.proxy.settings.set({
			value: { mode: 'direct' },
			scope: 'regular',
		})
		await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [1],
		})
		return
	}

	const domains = normalizeDomains(settings.domains)
	const pacScript = buildPacScript(
		settings.host,
		settings.httpPort,
		settings.httpsPort,
		domains,
	)
	await chrome.proxy.settings.set({
		value: {
			mode: 'pac_script',
			pacScript: { data: pacScript },
		},
		scope: 'regular',
	})

	if (settings.apiKey) {
		const rule = {
			id: 1,
			priority: 1,
			action: {
				type: 'modifyHeaders',
				requestHeaders: [
					{
						header: 'X-Proxy-Api-Key',
						operation: 'set',
						value: settings.apiKey,
					},
					{
						header: 'Proxy-Authorization',
						operation: 'set',
						value: `ApiKey ${settings.apiKey}`,
					},
				],
			},
			condition: {
				urlFilter: '*',
				resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'],
			},
		}
		if (domains.length) {
			rule.condition.domains = domains
		}
		await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [1],
			addRules: [rule],
		})
	} else {
		await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [1],
		})
	}
}

chrome.runtime.onInstalled.addListener(() => {
	applyProxySettings()
})

chrome.runtime.onStartup.addListener(() => {
	applyProxySettings()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message && message.type === 'apply') {
		applyProxySettings().then(() => sendResponse({ ok: true }))
		return true
	}
	return false
})
