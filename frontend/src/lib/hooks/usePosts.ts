import { setPosts } from '@/lib/features/postsSlice'
import { useAppDispatch } from '@/lib/hooks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Attachment } from '@/lib/types'

type PostData = {
	id: string
	posted_by: string
	author_name: string
	author_avatar: string | null
	content: string
	created_at: string
	likes?: number
	comments_count?: number
	is_liked?: boolean
	image?: string
	attachments?: Attachment[]
}

export function usePosts() {
	const dispatch = useAppDispatch()
	const queryClient = useQueryClient()

	const query = useQuery({
		queryKey: ['posts'],
		queryFn: async () => {
			const res = await fetch('/api/posts')
			if (!res.ok) throw new Error('Failed to fetch posts')
			return res.json() as Promise<PostData[]>
		},
	})

	useEffect(() => {
		if (query.data) {
			dispatch(setPosts(query.data))
		}
	}, [query.data, dispatch])

	const createPostMutation = useMutation({
		mutationFn: async ({
			text,
			attachments,
		}: {
			text: string
			attachments?: Attachment[]
		}) => {
			const res = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: 'New Post',
					content: text,
					attachments,
				}),
			})
			if (!res.ok) throw new Error('Failed to create post')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['posts'] })
		},
	})

	const deletePostMutation = useMutation({
		mutationFn: async ({
			id,
			reason,
			userId,
		}: {
			id: string | number
			reason?: string
			userId: string
		}) => {
			const res = await fetch(`/api/posts/${id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: userId, reason }),
			})
			if (!res.ok) throw new Error('Failed to delete post')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['posts'] })
		},
	})

	const updatePostMutation = useMutation({
		mutationFn: async ({
			id,
			newText,
		}: {
			id: string | number
			newText: string
		}) => {
			const res = await fetch(`/api/posts/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Updated Post', content: newText }),
			})
			if (!res.ok) throw new Error('Failed to update post')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['posts'] })
		},
	})

	return {
		...query,
		createPost: createPostMutation.mutate,
		deletePost: deletePostMutation.mutate,
		updatePost: updatePostMutation.mutate,
	}
}
