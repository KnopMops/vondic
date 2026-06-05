import {useCallback, useEffect, useState} from 'react';
import {publicApiClient} from '@/api/client';

export interface PostItem {
  id: string;
  posted_by: string;
  author_name: string;
  author_avatar: string | null;
  author_premium?: boolean;
  content: string;
  created_at: string;
  likes?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_blog?: boolean;
  image?: string;
  attachments?: {url: string; name: string; ext: string; size: number}[];
}

interface PostsResponse {
  items: PostItem[];
  total: number;
  pages: number;
  page: number;
  per_page: number;
}

export function usePosts() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = useCallback(async (nextPage = 1) => {
    setIsLoading(true);
    try {
      const query = `page=${nextPage}&per_page=10`;
      // Use frontend /api/posts route (enriched with author data)
      const data = await publicApiClient.get<PostsResponse>(`/posts?${query}`);
      if (nextPage === 1) {
        setPosts(data.items || []);
      } else {
        setPosts(prev => [...prev, ...(data.items || [])]);
      }
      setPage(data.page || nextPage);
      setHasMore((data.page || nextPage) < (data.pages || 1));
    } catch (err: any) {
      console.error('[Posts] Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchPosts(page + 1);
    }
  }, [isLoading, hasMore, page, fetchPosts]);

  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]);

  return {posts, isLoading, hasMore, loadMore, refresh: () => fetchPosts(1)};
}
