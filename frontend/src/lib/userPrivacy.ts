// Minimal implementation — shows email only to the user themself
export function userShowsEmail(user: { id?: string | number; show_email?: boolean }, currentUserId?: string | number): boolean {
	if (!user) return false
	if (currentUserId !== undefined && String(user.id) === String(currentUserId)) return true
	return !!user.show_email
}
