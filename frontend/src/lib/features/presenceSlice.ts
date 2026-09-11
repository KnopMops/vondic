import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface UserPresence {
	status: 'online' | 'offline' | string
	lastSeen?: string | null
}

export interface PresenceState {
	statuses: Record<string, UserPresence>
}

const initialState: PresenceState = {
	statuses: {},
}

export const presenceSlice = createSlice({
	name: 'presence',
	initialState,
	reducers: {
		updateUserStatus: (
			state,
			action: PayloadAction<{ userId: string; status: string; lastSeen?: string | null }>
		) => {
			const { userId, status, lastSeen } = action.payload
			state.statuses[userId] = {
				status,
				lastSeen: lastSeen !== undefined ? lastSeen : state.statuses[userId]?.lastSeen || null,
			}
		},
		bulkUpdateStatuses: (
			state,
			action: PayloadAction<Array<{ user_id: string; status: string; last_seen?: string | null }>>
		) => {
			for (const item of action.payload) {
				state.statuses[item.user_id] = {
					status: item.status,
					lastSeen: item.last_seen || null,
				}
			}
		},
	},
})

export const { updateUserStatus, bulkUpdateStatuses } = presenceSlice.actions
export default presenceSlice.reducer
