import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { User } from '../types'

interface AuthState {
	user: User | null
	isLoading: boolean
	error: string | null
	isInitialized: boolean
}

const initialState: AuthState = {
	user: null,
	isLoading: false,
	error: null,
	isInitialized: false,
}

export const fetchUser = createAsyncThunk('auth/fetchUser', async () => {
	const response = await fetch('/api/auth/me')
	const refreshed = response.headers.get('x-auth-refreshed') === '1'

	if (!response.ok) {
		if (response.status === 401 || response.status === 404) {
			return null
		}
		throw new Error('Failed to fetch user')
	}

	const data = await response.json()

	if (refreshed && typeof window !== 'undefined') {
		window.location.reload()
	}

	return data.user
})

const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {
		setUser: (state, action: PayloadAction<User | null>) => {
			state.user = action.payload
			state.isInitialized = true
		},
		setSocketId: (state, action: PayloadAction<string>) => {
			if (state.user) {
				state.user.socket_id = action.payload
			}
		},
		logout: state => {
			state.user = null
			state.isInitialized = true
		},
	},
	extraReducers: builder => {
		builder
			.addCase(fetchUser.pending, state => {
				state.isLoading = true
				state.error = null
			})
			.addCase(fetchUser.fulfilled, (state, action) => {
				state.isLoading = false
				
				
				if (
					action.payload &&
					!action.payload.socket_id &&
					state.user?.socket_id
				) {
					state.user = { ...action.payload, socket_id: state.user.socket_id }
				} else {
					state.user = action.payload
				}
				state.isInitialized = true
			})
			.addCase(fetchUser.rejected, (state, action) => {
				state.isLoading = false
				state.error = action.error.message || 'Failed to fetch user'
				state.isInitialized = true
			})
	},
})

export const { setUser, logout, setSocketId } = authSlice.actions
export default authSlice.reducer
