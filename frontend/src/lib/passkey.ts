import { saveAccount } from '@/lib/savedAccounts'

export function isPasskeySupported(): boolean {
	if (typeof window === 'undefined') return false
	const isLocal =
		window.location.hostname === 'localhost' ||
		window.location.hostname === '127.0.0.1'
	const isSecure = window.isSecureContext || isLocal
	return (
		isSecure &&
		!!window.PublicKeyCredential &&
		typeof navigator.credentials?.create === 'function' &&
		typeof navigator.credentials?.get === 'function'
	)
}

function getValidRpConfig(serverRp?: { name?: string; id?: string }): { name: string; id?: string } {
	const currentHostname = typeof window !== 'undefined' ? window.location.hostname : ''
	const isLocal = currentHostname === 'localhost' || currentHostname === '127.0.0.1'
	const name = serverRp?.name || 'Vondic'

	if (isLocal) {
		return { name, id: 'localhost' }
	}
	if (!currentHostname) {
		return { name }
	}
	const targetId = serverRp?.id || currentHostname
	if (currentHostname === targetId || currentHostname.endsWith('.' + targetId)) {
		return { name, id: targetId }
	}
	return { name, id: currentHostname }
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	let binary = ''
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '')
}

export function base64UrlToBuffer(base64url: string): ArrayBuffer {
	let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
	while (base64.length % 4 !== 0) {
		base64 += '='
	}
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes.buffer
}

function getAuthHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	}
	if (typeof window !== 'undefined') {
		const token = localStorage.getItem('access_token')
		if (token) {
			headers['Authorization'] = `Bearer ${token}`
		}
	}
	return headers
}

export interface RegisterPasskeyParams {
	email: string
	username: string
	password?: string
	deviceName?: string
}

export async function registerWithPasskey(params: RegisterPasskeyParams) {
	if (!isPasskeySupported()) {
		throw new Error('Ваш браузер или устройство не поддерживает Passkey (WebAuthn)')
	}

	// 1. Запрос опций регистрации с сервера
	const optRes = await fetch('/api/auth/passkey/register-options', {
		method: 'POST',
		credentials: 'include',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			email: params.email,
			username: params.username,
		}),
	})

	const options = await optRes.json()
	if (!optRes.ok) {
		throw new Error(options.error || 'Не удалось получить опции Passkey')
	}

	// 2. Преобразуем challenge и user.id в Buffer
	const rp = getValidRpConfig(options.rp)
	const publicKey: PublicKeyCredentialCreationOptions = {
		...options,
		rp,
		challenge: base64UrlToBuffer(options.challenge),
		user: {
			...options.user,
			id: base64UrlToBuffer(options.user.id),
		},
	}

	// 3. Вызов биометрии / создания ключа на устройстве
	let credential: PublicKeyCredential | null = null
	try {
		credential = (await navigator.credentials.create({
			publicKey,
		})) as PublicKeyCredential
	} catch (err: any) {
		if (err.name === 'NotAllowedError') {
			throw new Error('Создание Passkey отменено на устройстве')
		}
		if (err.name === 'SecurityError') {
			try {
				const fallbackKey = { ...publicKey, rp: { name: rp.name } }
				credential = (await navigator.credentials.create({
					publicKey: fallbackKey,
				})) as PublicKeyCredential
			} catch {
				throw new Error(err.message || 'Ошибка безопасности при создании Passkey')
			}
		} else {
			throw new Error(err.message || 'Ошибка создания Passkey')
		}
	}

	if (!credential) {
		throw new Error('Создание Passkey отменено')
	}

	const rawResponse = credential.response as AuthenticatorAttestationResponse

	const credentialPayload = {
		id: credential.id,
		rawId: bufferToBase64Url(credential.rawId),
		type: credential.type,
		response: {
			clientDataJSON: bufferToBase64Url(rawResponse.clientDataJSON),
			attestationObject: bufferToBase64Url(rawResponse.attestationObject),
		},
	}

	// 4. Верификация на бэкенде
	const verifyRes = await fetch('/api/auth/passkey/register-verify', {
		method: 'POST',
		credentials: 'include',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			credential: credentialPayload,
			password: params.password,
			device_name: params.deviceName || 'Устройство (Passkey)',
			email: params.email,
			username: params.username,
		}),
	})

	const data = await verifyRes.json()
	if (!verifyRes.ok) {
		throw new Error(data.error || 'Ошибка верификации Passkey')
	}

	// Сохраняем аккаунт локально
	if (data.user && data.access_token) {
		localStorage.setItem('user', JSON.stringify(data.user))
		localStorage.setItem('access_token', data.access_token)
		saveAccount({
			id: data.user.id,
			email: data.user.email,
			username: data.user.username,
			avatar_url: data.user.avatar_url ?? null,
			auth_provider: 'email',
			last_login_at: Date.now(),
			added_at: Date.now(),
			refresh_token: data.refresh_token || undefined,
		})
	}

	return data
}

export async function loginWithPasskey(email?: string) {
	if (!isPasskeySupported()) {
		throw new Error('Ваш браузер или устройство не поддерживает Passkey (WebAuthn)')
	}

	// 1. Запрос challenge для входа
	const optRes = await fetch('/api/auth/passkey/login-options', {
		method: 'POST',
		credentials: 'include',
		headers: getAuthHeaders(),
		body: email ? JSON.stringify({ email }) : undefined,
	})

	const options = await optRes.json()
	if (!optRes.ok) {
		throw new Error(options.error || 'Не удалось получить опции входа Passkey')
	}

	// 2. Преобразуем challenge и allowCredentials
	const rp = getValidRpConfig(options.rp ? options.rp : { id: options.rpId })
	const allowCredentials = Array.isArray(options.allowCredentials)
		? options.allowCredentials.map((c: any) => ({
				...c,
				id: typeof c.id === 'string' ? base64UrlToBuffer(c.id) : c.id,
		  }))
		: undefined

	const publicKey: PublicKeyCredentialRequestOptions = {
		...options,
		challenge: base64UrlToBuffer(options.challenge),
		rpId: rp.id,
		...(allowCredentials ? { allowCredentials } : {}),
	}

	// 3. Вызов биометрии / FaceID / TouchID / Windows Hello
	let assertion: PublicKeyCredential | null = null
	try {
		assertion = (await navigator.credentials.get({
			publicKey,
		})) as PublicKeyCredential
	} catch (err: any) {
		if (err.name === 'NotAllowedError') {
			throw new Error('Вход по Passkey отменен')
		}
		if (err.name === 'SecurityError') {
			try {
				const fallbackKey = { ...publicKey }
				delete fallbackKey.rpId
				assertion = (await navigator.credentials.get({
					publicKey: fallbackKey,
				})) as PublicKeyCredential
			} catch {
				throw new Error(err.message || 'Ошибка входа по Passkey')
			}
		} else {
			throw new Error(err.message || 'Ошибка входа по Passkey')
		}
	}

	if (!assertion) {
		throw new Error('Вход по Passkey отменен')
	}

	const rawResponse = assertion.response as AuthenticatorAssertionResponse

	const credentialPayload = {
		id: assertion.id,
		rawId: bufferToBase64Url(assertion.rawId),
		type: assertion.type,
		response: {
			clientDataJSON: bufferToBase64Url(rawResponse.clientDataJSON),
			authenticatorData: bufferToBase64Url(rawResponse.authenticatorData),
			signature: bufferToBase64Url(rawResponse.signature),
			userHandle: rawResponse.userHandle
				? bufferToBase64Url(rawResponse.userHandle)
				: null,
		},
	}

	// 4. Верификация на бэкенде
	const verifyRes = await fetch('/api/auth/passkey/login-verify', {
		method: 'POST',
		credentials: 'include',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			credential: credentialPayload,
		}),
	})

	const data = await verifyRes.json()
	if (!verifyRes.ok) {
		throw new Error(data.error || 'Ошибка входа по Passkey')
	}

	// Сохраняем аккаунт
	if (data.user && data.access_token) {
		localStorage.setItem('user', JSON.stringify(data.user))
		localStorage.setItem('access_token', data.access_token)
		saveAccount({
			id: data.user.id,
			email: data.user.email,
			username: data.user.username,
			avatar_url: data.user.avatar_url ?? null,
			auth_provider: 'email',
			last_login_at: Date.now(),
			added_at: Date.now(),
			refresh_token: data.refresh_token || undefined,
		})
	}

	return data
}

export async function createPasskeyMigration() {
	const res = await fetch('/api/auth/passkey/migrate/create', {
		method: 'POST',
		credentials: 'include',
		headers: getAuthHeaders(),
	})
	const data = await res.json()
	if (!res.ok) {
		throw new Error(data.error || 'Не удалось создать сессию миграции')
	}
	return data as { migration_token: string; migrate_url: string; expires_in: number }
}

export async function checkPasskeyMigrationStatus(token: string) {
	const res = await fetch(
		`/api/auth/passkey/migrate/status?token=${encodeURIComponent(token)}`,
		{
			credentials: 'include',
			headers: getAuthHeaders(),
		},
	)
	const data = await res.json()
	return data.status as 'pending' | 'completed' | 'expired'
}

export async function completePasskeyMigration(migrationToken: string) {
	if (!isPasskeySupported()) {
		throw new Error('Ваш телефон/устройство не поддерживает Passkey (WebAuthn)')
	}

	// 1. Получаем инфо и опции
	const infoRes = await fetch(
		`/api/auth/passkey/migrate/info?token=${encodeURIComponent(migrationToken)}`,
		{
			credentials: 'include',
			headers: getAuthHeaders(),
		},
	)
	const info = await infoRes.json()
	if (!infoRes.ok) {
		throw new Error(info.error || 'QR-код миграции недействителен или устарел')
	}

	const options = info.options
	const rp = getValidRpConfig(options.rp)
	const publicKey: PublicKeyCredentialCreationOptions = {
		...options,
		rp,
		challenge: base64UrlToBuffer(options.challenge),
		user: {
			...options.user,
			id: base64UrlToBuffer(options.user.id),
		},
	}

	// 2. Создание Passkey на телефоне с биометрией
	let credential: PublicKeyCredential | null = null
	try {
		credential = (await navigator.credentials.create({
			publicKey,
		})) as PublicKeyCredential
	} catch (err: any) {
		if (err.name === 'NotAllowedError') {
			throw new Error('Создание Passkey отменено на устройстве')
		}
		if (err.name === 'SecurityError') {
			try {
				const fallbackKey = { ...publicKey, rp: { name: rp.name } }
				credential = (await navigator.credentials.create({
					publicKey: fallbackKey,
				})) as PublicKeyCredential
			} catch {
				throw new Error(err.message || 'Ошибка безопасности биометрии')
			}
		} else {
			throw new Error(err.message || 'Ошибка биометрии на телефоне')
		}
	}

	if (!credential) {
		throw new Error('Создание Passkey на устройстве отменено')
	}

	const rawResponse = credential.response as AuthenticatorAttestationResponse
	const credentialPayload = {
		id: credential.id,
		rawId: bufferToBase64Url(credential.rawId),
		type: credential.type,
		response: {
			clientDataJSON: bufferToBase64Url(rawResponse.clientDataJSON),
			attestationObject: bufferToBase64Url(rawResponse.attestationObject),
		},
	}

	// 3. Завершаем миграцию на бэкенде
	const completeRes = await fetch('/api/auth/passkey/migrate/complete', {
		method: 'POST',
		credentials: 'include',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			token: migrationToken,
			credential: credentialPayload,
			device_name: 'Телефон (Миграция Passkey)',
		}),
	})

	const data = await completeRes.json()
	if (!completeRes.ok) {
		throw new Error(data.error || 'Не удалось завершить миграцию Passkey')
	}

	// Сохраняем сессию на телефоне
	if (data.user && data.access_token) {
		localStorage.setItem('user', JSON.stringify(data.user))
		localStorage.setItem('access_token', data.access_token)
		saveAccount({
			id: data.user.id,
			email: data.user.email,
			username: data.user.username,
			avatar_url: data.user.avatar_url ?? null,
			auth_provider: 'email',
			last_login_at: Date.now(),
			added_at: Date.now(),
			refresh_token: data.refresh_token || undefined,
		})
	}

	return data
}
