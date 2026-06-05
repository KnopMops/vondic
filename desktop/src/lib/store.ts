import { configureStore } from '@reduxjs/toolkit'
import authReducer from './features/authSlice'
import postsReducer from './features/postsSlice'

export const makeStore = () => {
	return configureStore({
		reducer: {
			auth: authReducer,
			posts: postsReducer,
		},
	})
}

export type AppStore = ReturnType<typeof makeStore>

export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
