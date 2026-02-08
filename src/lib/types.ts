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
