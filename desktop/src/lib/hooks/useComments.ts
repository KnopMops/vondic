import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type Comment = {
	id: string
	content: string
	user_id: string
	created_at?: string
	author_name?: string
	author_avatar?: string
	parent_id?: string
	likes?: number
	is_liked?: boolean
	children?: Comment[]
}

export function useComments(postId: string | number) {
	const queryClient = useQueryClient()
	const queryKey = ['comments', postId]

	const query = useQuery({
		queryKey,
		queryFn: async () => {
			const res = await fetch(`/api/posts/${postId}/comments`)
			if (!res.ok) throw new Error('Failed to fetch comments')
			return res.json() as Promise<Comment[]>
		},
	})

	const createCommentMutation = useMutation({
		mutationFn: async ({
			content,
			replyToId,
		}: {
			content: string
			replyToId?: string
		}) => {
			const payload: any = {
				content,
				post_id: postId,
			}
			if (replyToId) {
				payload.parent_id = replyToId
			}

			const res = await fetch(`/api/posts/${postId}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			if (!res.ok) throw new Error('Failed to create comment')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey })
			queryClient.invalidateQueries({ queryKey: ['posts'] }) // Update post comment count
		},
	})

	const updateCommentMutation = useMutation({
		mutationFn: async ({ id, content }: { id: string; content: string }) => {
			const res = await fetch('/api/comments', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ comment_id: id, content }),
			})
			if (!res.ok) throw new Error('Failed to update comment')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey })
		},
	})

	const deleteCommentMutation = useMutation({
		mutationFn: async ({
			id,
			userId,
			isAdmin,
			reason,
		}: {
			id: string
			userId: string
			isAdmin?: boolean
			reason?: string
		}) => {
			const payload: any = {
				comment_id: id,
				user_id: userId,
				isAdmin,
			}
			if (isAdmin) {
				payload.reason = reason
			}

			const res = await fetch('/api/comments', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			if (!res.ok) throw new Error('Failed to delete comment')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey })
			queryClient.invalidateQueries({ queryKey: ['posts'] }) // Update post comment count
		},
	})

	return {
		...query,
		createComment: createCommentMutation.mutate,
		updateComment: updateCommentMutation.mutate,
		deleteComment: deleteCommentMutation.mutate,
		isCreating: createCommentMutation.isPending,
		isUpdating: updateCommentMutation.isPending,
		isDeleting: deleteCommentMutation.isPending,
	}
}
