import { setPosts } from '@/lib/features/postsSlice'
import { useAppDispatch } from '@/lib/hooks'
import { Attachment } from '@/lib/types'
import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

export type PostData = {
	id: string
	posted_by: string
	author_name: string
	author_avatar: string | null
	author_premium?: boolean
	content: string
	created_at: string
	likes?: number
	comments_count?: number
	is_liked?: boolean
	image?: string
	attachments?: Attachment[]
}

type PostsResponse = {
	items: PostData[]
	total: number
	pages: number
	page: number
	per_page: number
}

export function usePosts({ perPage = 5 }: { perPage?: number } = {}) {
	const dispatch = useAppDispatch()
	const queryClient = useQueryClient()

	const query = useInfiniteQuery<
		PostsResponse,
		Error,
		PostsResponse,
		(string | number)[],
		number
	>({
		queryKey: ['posts', perPage],
		initialPageParam: 1,
		queryFn: async ({ pageParam = 1 }) => {
			const res = await fetch(
				`/api/posts?page=${pageParam}&per_page=${perPage}`,
			)
			if (!res.ok) throw new Error('Failed to fetch posts')
			return res.json() as Promise<PostsResponse>
		},
		getNextPageParam: lastPage => {
			const currentPage = lastPage.page || 1
			const totalPages = lastPage.pages || 1
			return currentPage < totalPages ? currentPage + 1 : undefined
		},
	})

	const posts = useMemo<PostData[]>(() => {
		const pages = (query.data?.pages || []) as PostsResponse[]
		return pages.flatMap(p => p.items || [])
	}, [query.data])

	useEffect(() => {
		if (query.data) {
			dispatch(setPosts(posts))
		}
	}, [posts, dispatch, query.data])

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
		posts,
		loadMore: () => query.fetchNextPage(),
		hasMore: query.hasNextPage,
		isLoadingMore: query.isFetchingNextPage,
		createPost: createPostMutation.mutate,
		deletePost: deletePostMutation.mutate,
		updatePost: updatePostMutation.mutate,
	}
}
