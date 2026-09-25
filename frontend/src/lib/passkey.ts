import { saveAccount } from '@/lib/savedAccounts'

export function isPasskeySupported(): boolean {
	if (typeof window === 'undefined') return false
	return (
		!!window.PublicKeyCredential &&
		typeof navigator.credentials?.create === 'function' &&
		typeof navigator.credentials?.get === 'function'
	)
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
		headers: { 'Content-Type': 'application/json' },
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
	const publicKey: PublicKeyCredentialCreationOptions = {
		...options,
		challenge: base64UrlToBuffer(options.challenge),
		user: {
			...options.user,
			id: base64UrlToBuffer(options.user.id),
		},
	}

	// 3. Вызов биометрии / создания ключа на устройстве
	const credential = (await navigator.credentials.create({
		publicKey,
	})) as PublicKeyCredential

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
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			credential: credentialPayload,
			password: params.password,
			device_name: params.deviceName || 'Устройство (Passkey)',
		}),
	})

	const data = await verifyRes.json()
	if (!verifyRes.ok) {
		throw new Error(data.error || 'Ошибка верификации Passkey')
	}

	// Сохраняем аккаунт локально
	if (data.user && data.access_token) {
		localStorage.setItem('user', JSON.stringify(data.user))
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

export async function loginWithPasskey() {
	if (!isPasskeySupported()) {
		throw new Error('Ваш браузер или устройство не поддерживает Passkey (WebAuthn)')
	}

	// 1. Запрос challenge для входа
	const optRes = await fetch('/api/auth/passkey/login-options', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
	})

	const options = await optRes.json()
	if (!optRes.ok) {
		throw new Error(options.error || 'Не удалось получить опции входа Passkey')
	}

	// 2. Преобразуем challenge
	const publicKey: PublicKeyCredentialRequestOptions = {
		...options,
		challenge: base64UrlToBuffer(options.challenge),
	}

	// 3. Вызов биометрии / FaceID / TouchID / Windows Hello
	const assertion = (await navigator.credentials.get({
		publicKey,
	})) as PublicKeyCredential

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
		headers: { 'Content-Type': 'application/json' },
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
		headers: { 'Content-Type': 'application/json' },
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
	)
	const info = await infoRes.json()
	if (!infoRes.ok) {
		throw new Error(info.error || 'QR-код миграции недействителен или устарел')
	}

	const options = info.options
	const publicKey: PublicKeyCredentialCreationOptions = {
		...options,
		challenge: base64UrlToBuffer(options.challenge),
		user: {
			...options.user,
			id: base64UrlToBuffer(options.user.id),
		},
	}

	// 2. Создание Passkey на телефоне с биометрией
	const credential = (await navigator.credentials.create({
		publicKey,
	})) as PublicKeyCredential

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
		headers: { 'Content-Type': 'application/json' },
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
