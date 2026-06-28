import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface Post {
	id: string
	posted_by: string
	author_name: string
	author_avatar: string | null
	content: string
	created_at: string
	likes?: number
	comments_count?: number
	is_liked?: boolean
	is_blog?: boolean
	image?: string
}

interface PostsState {
	posts: Post[]
}

const initialState: PostsState = {
	posts: [],
}

const postsSlice = createSlice({
	name: 'posts',
	initialState,
	reducers: {
		setPosts: (state, action: PayloadAction<Post[]>) => {
			state.posts = action.payload
		},
		addPost: (state, action: PayloadAction<Post>) => {
			state.posts.unshift(action.payload)
		},
		updatePost: (state, action: PayloadAction<{ id: string | number; content: string }>) => {
			const post = state.posts.find(p => p.id === action.payload.id)
			if (post) {
				post.content = action.payload.content
			}
		},
		deletePost: (state, action: PayloadAction<string | number>) => {
			state.posts = state.posts.filter(p => p.id !== action.payload)
		},
	},
})

export const { setPosts, addPost, updatePost, deletePost } = postsSlice.actions
export default postsSlice.reducer
