import {useCallback, useState} from 'react';
import {Channel} from '@/types';
import {apiClient} from '@/api/client';
import {useAppSelector} from '@/store/hooks';

export const useChannels = () => {
  const {user} = useAppSelector(state => state.auth);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyChannels = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.post<Channel[]>('/channels/my', {});
      setChannels(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch channels');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const createChannel = useCallback(
    async (name: string, description: string) => {
      if (!user) throw new Error('Unauthorized');
      setIsLoading(true);
      setError(null);
      try {
        const newChannel = await apiClient.post<Channel>('/channels', {
          name,
          description,
        });
        setChannels(prev => [...prev, newChannel]);
        return newChannel;
      } catch (err: any) {
        setError(err.message || 'Failed to create channel');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const joinChannel = useCallback(
    async (inviteCode: string) => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const channel = await apiClient.post<Channel>('/channels/join', {
          invite_code: inviteCode,
        });
        setChannels(prev => {
          if (prev.find(c => c.id === channel.id)) return prev;
          return [...prev, channel];
        });
        return channel;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const getChannelInfo = useCallback(
    async (id: string) => {
      if (!user) return null;
      try {
        return await apiClient.post<Channel>(`/channels/${id}`, {});
      } catch {
        return null;
      }
    },
    [user],
  );

  const searchChannels = useCallback(
    async (query: string) => {
      if (!user) return [];
      try {
        const data = await apiClient.post<{channels?: Channel[]}>('/channels/search', {query});
        return data.channels || [];
      } catch {
        return [];
      }
    },
    [user],
  );

  const updateChannel = useCallback(
    async (id: string, data: {name?: string; description?: string; avatar_url?: string}) => {
      if (!user) throw new Error('Unauthorized');
      const updated = await apiClient.put<Channel>(`/channels/${id}`, data);
      setChannels(prev => prev.map(ch => (ch.id === id ? updated : ch)));
      return updated;
    },
    [user],
  );

  return {
    channels,
    isLoading,
    error,
    fetchMyChannels,
    createChannel,
    joinChannel,
    getChannelInfo,
    searchChannels,
    updateChannel,
  };
};
