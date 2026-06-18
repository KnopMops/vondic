import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {Config} from '@/constants/config';
import {usePosts} from '@/hooks/usePosts';
import {apiClient} from '@/api/client';
import {useAppSelector} from '@/store/hooks';
import Icon from 'react-native-vector-icons/Ionicons';
import {appLog} from '@/utils/appLogger';
import ScreenHeader from '@/components/ScreenHeader';

interface Comment {
  id: string;
  content: string;
  author_name?: string;
  created_at?: string;
  posted_by?: string;
}

export default function FeedScreen() {
  const {user} = useAppSelector(state => state.auth);
  const {posts, isLoading, hasMore, loadMore, refresh} = usePosts();
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});
  const [loadingComments, setLoadingComments] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [editPostContent, setEditPostContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    setCreating(true);
    try {
      await apiClient.post('/posts', {
        content: newPostContent.trim(),
        attachments: [],
      });
      setNewPostContent('');
      setCreateModalVisible(false);
      refresh();
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось создать пост');
    } finally {
      setCreating(false);
    }
  };

  const handleEditPost = async () => {
    if (!editingPost?.id || !editPostContent.trim()) return;
    setSavingEdit(true);
    try {
      await apiClient.put('/posts', {
        post_id: editingPost.id,
        content: editPostContent.trim(),
        attachments: editingPost.attachments || [],
      });
      setEditModalVisible(false);
      setEditingPost(null);
      refresh();
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось обновить пост');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert('Удалить пост', 'Вы уверены?', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete('/posts', {body: {post_id: postId, user_id: user?.id}} as any);
            refresh();
          } catch (err: any) {
            Alert.alert('Ошибка', err.message || 'Не удалось удалить пост');
          }
        },
      },
    ]);
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    const nextIsLiked = !isLiked;
    appLog('FeedScreen', 'handleLike', {postId, isLiked, nextIsLiked});
    setLikedMap(prev => ({...prev, [postId]: nextIsLiked}));
    try {
      const endpoint = isLiked ? '/posts/unlike' : '/posts/like';
      await apiClient.post(endpoint, {post_id: postId});
      appLog('FeedScreen', 'handleLike success', {postId, endpoint});
      setLikedMap(prev => {
        const next = {...prev};
        delete next[postId];
        return next;
      });
      await refresh();
    } catch (err: any) {
      appLog('FeedScreen', 'handleLike error', {postId, message: err?.message || String(err)});
      setLikedMap(prev => ({...prev, [postId]: isLiked}));
      Alert.alert('Ошибка', err.message || 'Не удалось поставить лайк');
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    appLog('FeedScreen', 'handleDeleteComment', {postId, commentId});
    Alert.alert('Удалить комментарий', 'Вы уверены?', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete('/comments', {body: {comment_id: commentId, user_id: user?.id}} as any);
            appLog('FeedScreen', 'deleteComment success', {postId, commentId});
            refresh();
            if (commentingPostId === postId) {
              loadComments(postId);
            }
          } catch (err: any) {
            appLog('FeedScreen', 'deleteComment error', {postId, commentId, message: err?.message || String(err)});
            Alert.alert('Ошибка', err.message || 'Не удалось удалить комментарий');
          }
        },
      },
    ]);
  };

  const handleComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    try {
      await apiClient.post('/posts/comment', {post_id: postId, content: text});
      setCommentInputs(prev => ({...prev, [postId]: ''}));
      refresh();
      if (commentingPostId === postId) {
        loadComments(postId);
      }
    } catch (err: any) {
      Alert.alert('Ошибка', 'Не удалось отправить комментарий');
    }
  };

  const loadComments = useCallback(async (postId: string) => {
    setLoadingComments(postId);
    try {
      const data = await apiClient.get<any>('/posts/' + postId + '/comments');
      const comments = Array.isArray(data) ? data : (data.comments || []);
      setPostComments(prev => ({...prev, [postId]: comments}));
    } catch (err) {
      console.error('[Feed] Failed to load comments:', err);
    } finally {
      setLoadingComments(null);
    }
  }, []);

  const toggleComments = (postId: string) => {
    if (commentingPostId === postId) {
      setCommentingPostId(null);
    } else {
      setCommentingPostId(postId);
      loadComments(postId);
    }
  };

  const openEditModal = (post: any) => {
    setEditingPost(post);
    setEditPostContent(post.content || '');
    setEditModalVisible(true);
  };

  const renderPost = ({item}: {item: any}) => {
    if (!item || typeof item !== 'object') return null;

    const isOwn = item.posted_by === user?.id || item.author_id === user?.id;
    const attachments = item.attachments || [];
    const imageUrls: string[] = [];
    if (Array.isArray(attachments)) {
      attachments.forEach((a: any) => {
        const url = typeof a === 'string' ? a : a?.url;
        if (url && (url.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i))) {
          imageUrls.push(url);
        }
      });
    }

    const isLiked = likedMap[item.id] !== undefined ? likedMap[item.id] : !!item.is_liked;
    const isCommenting = commentingPostId === item.id;
    const comments = postComments[item.id] || [];

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
            {item.author_avatar ? (
              <Image
                source={{uri: item.author_avatar.startsWith('http') ? item.author_avatar : Config.BACKEND_URL + item.author_avatar}}
                style={styles.postAvatarImage}
              />
            ) : (
              <View style={styles.postAvatar}>
                <Text style={styles.postAvatarText}>
                  {item.author_name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.postAuthor}>{item.author_name || 'Неизвестно'}</Text>
              <Text style={styles.postDate}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString('ru-RU') : ''}
              </Text>
            </View>
          </View>
          {isOwn && (
            <View style={{flexDirection: 'row', gap: 12}}>
              <TouchableOpacity onPress={() => openEditModal(item)}>
                <Icon name="create-outline" size={18} color="#888" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeletePost(item.id)}>
                <Icon name="trash-outline" size={18} color="#ff4757" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.postContent}>{String(item.content || '')}</Text>

        {imageUrls.length > 0 && (
          <View style={styles.imageContainer}>
            {imageUrls.map((url, idx) => (
              <Image
                key={idx}
                source={{uri: url.startsWith('http') ? url : Config.BACKEND_URL + url}}
                style={styles.postImage}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item.id, isLiked)}>
            <Icon name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? '#ff4757' : '#888'} />
            <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>{item.likes || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => toggleComments(item.id)}>
            <Icon name="chatbubble-outline" size={20} color="#888" />
            <Text style={styles.actionText}>{item.comments_count || 0}</Text>
          </TouchableOpacity>
        </View>

        {isCommenting && (
          <View style={styles.commentsSection}>
            {loadingComments === item.id ? (
              <ActivityIndicator color="#6c5ce7" size="small" />
            ) : (
              <>
                {comments.length > 0 ? (
                  comments.map((c, idx) => {
                    const isOwnComment = c.posted_by === user?.id;
                    return (
                      <View key={c.id || idx} style={styles.commentItem}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                          <Text style={styles.commentAuthor}>{c.author_name || 'Пользователь'}</Text>
                          {isOwnComment && (
                            <TouchableOpacity onPress={() => handleDeleteComment(item.id, c.id)}>
                              <Icon name="trash-outline" size={14} color="#ff4757" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.commentText}>{c.content}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noCommentsText}>Пока нет комментариев</Text>
                )}
              </>
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Написать комментарий..."
                placeholderTextColor="#666"
                value={commentInputs[item.id] || ''}
                onChangeText={text => setCommentInputs(prev => ({...prev, [item.id]: text}))}
              />
              <TouchableOpacity onPress={() => handleComment(item.id)}>
                <Icon name="send" size={20} color="#6c5ce7" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Лента"
        rightElement={
          <TouchableOpacity style={styles.createButton} onPress={() => setCreateModalVisible(true)}>
            <Icon name="add-circle" size={28} color="#6c5ce7" />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={posts}
        keyExtractor={item => `post-${item?.id || Math.random()}`}
        renderItem={renderPost}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isLoading ? <ActivityIndicator color="#6c5ce7" style={{margin: 16}} /> : null}
        contentContainerStyle={{paddingBottom: 16}}
        refreshing={isLoading}
        onRefresh={refresh}
      />

      {/* Create Post Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={createModalVisible}
        onRequestClose={() => setCreateModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новый пост</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{flex: 1}}>
              <TextInput
                style={styles.modalInput}
                placeholder="Что у вас нового?"
                placeholderTextColor="#666"
                multiline
                value={newPostContent}
                onChangeText={setNewPostContent}
                maxLength={2000}
              />
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, (!newPostContent.trim() || creating) && styles.modalButtonDisabled]}
              onPress={handleCreatePost}
              disabled={!newPostContent.trim() || creating}>
              <Text style={styles.modalButtonText}>{creating ? 'Публикация...' : 'Опубликовать'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Post Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Редактировать пост</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{flex: 1}}>
              <TextInput
                style={styles.modalInput}
                placeholder="Текст поста..."
                placeholderTextColor="#666"
                multiline
                value={editPostContent}
                onChangeText={setEditPostContent}
                maxLength={2000}
              />
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, (!editPostContent.trim() || savingEdit) && styles.modalButtonDisabled]}
              onPress={handleEditPost}
              disabled={!editPostContent.trim() || savingEdit}>
              <Text style={styles.modalButtonText}>{savingEdit ? 'Сохранение...' : 'Сохранить'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  createButton: {
    padding: 4,
  },
  postCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  postAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  postAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  postAuthor: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  postDate: {
    color: '#888',
    fontSize: 12,
  },
  postContent: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  imageContainer: {
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 4,
  },
  postActions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#888',
    fontSize: 13,
  },
  actionTextActive: {
    color: '#ff4757',
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  commentItem: {
    marginBottom: 8,
  },
  commentAuthor: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
  },
  commentText: {
    color: '#ccc',
    fontSize: 13,
    marginTop: 2,
  },
  noCommentsText: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  commentInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalInput: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalButton: {
    backgroundColor: '#6c5ce7',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  modalButtonDisabled: {
    backgroundColor: '#333',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
