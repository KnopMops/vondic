import {useCallback, useState} from 'react';
import {Group} from '@/types';
import {apiClient} from '@/api/client';
import {useAppSelector} from '@/store/hooks';

export const useGroups = () => {
  const {user} = useAppSelector(state => state.auth);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyGroups = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.post<Group[]>('/groups/my', {});
      setGroups(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const createGroup = useCallback(
    async (name: string, description?: string) => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const newGroup = await apiClient.post<Group>('/groups', {name, description});
        setGroups(prev => [...prev, newGroup]);
        return newGroup;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const addParticipant = useCallback(
    async (groupId: string, userId: string) => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        await apiClient.post(`/groups/${groupId}/participants`, {user_id: userId});
        return true;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const getGroupParticipants = useCallback(
    async (groupId: string) => {
      if (!user) return [];
      setIsLoading(true);
      try {
        const data = await apiClient.get<any[]>(`/groups/${groupId}/participants`);
        return Array.isArray(data) ? data : [];
      } catch (err: any) {
        setError(err.message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const getGroupDetails = useCallback(
    async (groupId: string) => {
      if (!user) return null;
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.post<Group>('/groups/info', {group_id: groupId});
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const joinGroup = useCallback(
    async (inviteCode: string) => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.post<Group>('/groups/join', {invite_code: inviteCode});
        setGroups(prev => [...prev, data]);
        return data;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  return {
    groups,
    isLoading,
    error,
    fetchMyGroups,
    createGroup,
    addParticipant,
    getGroupParticipants,
    getGroupDetails,
    joinGroup,
  };
};
