import {useCallback, useEffect, useState} from 'react';
import {Community} from '@/types';
import {apiClient} from '@/api/client';
import {useAppSelector} from '@/store/hooks';

export const useCommunities = () => {
  const {user} = useAppSelector(state => state.auth);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyCommunities = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.post<Community[]>('/communities/my', {});
      setCommunities(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const createCommunity = useCallback(
    async (name: string, description?: string) => {
      if (!user) throw new Error('User not authenticated');
      const data = await apiClient.post<Community>('/communities', {name, description});
      await fetchMyCommunities();
      return data;
    },
    [user, fetchMyCommunities],
  );

  const joinCommunity = useCallback(
    async (inviteCode: string) => {
      if (!user) throw new Error('User not authenticated');
      const data = await apiClient.post<Community>('/communities/join', {invite_code: inviteCode});
      await fetchMyCommunities();
      return data;
    },
    [user, fetchMyCommunities],
  );

  const getCommunityDetails = useCallback(
    async (communityId: string) => {
      if (!user) throw new Error('User not authenticated');
      return await apiClient.post<Community>(`/communities/${communityId}`, {});
    },
    [user],
  );

  const searchCommunities = useCallback(
    async (query: string) => {
      if (!user) throw new Error('User not authenticated');
      const data = await apiClient.post<{communities?: Community[]}>('/communities/search', {
        query,
      });
      return data.communities || [];
    },
    [user],
  );

  const updateCommunity = useCallback(
    async (communityId: string, data: {name?: string; description?: string; avatar_url?: string}) => {
      if (!user) throw new Error('User not authenticated');
      const updated = await apiClient.put<Community>(`/communities/${communityId}`, data);
      setCommunities(prev => prev.map(c => (c.id === communityId ? updated : c)));
      return updated;
    },
    [user],
  );

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        fetchMyCommunities();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, fetchMyCommunities]);

  return {
    communities,
    isLoading,
    error,
    fetchMyCommunities,
    createCommunity,
    joinCommunity,
    getCommunityDetails,
    searchCommunities,
    updateCommunity,
  };
};
