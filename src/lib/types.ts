export interface User {
	id: string
	email: string
	username: string
	role: string
	avatar_url: string | null
	description?: string
	birth_date?: string
	socket_id?: string | null
	status?: string
}

export interface Channel {
	id: string
	name: string
	description: string
	invite_code: string
	owner_id: string
	participants_count: number
}
