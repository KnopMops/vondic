import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useNavigation, DrawerActions} from '@react-navigation/native';

interface ScreenHeaderProps {
  title: string;
  showSearch?: boolean;
  onSearchPress?: () => void;
  rightElement?: React.ReactNode;
}

export default function ScreenHeader({
  title,
  showSearch = false,
  onSearchPress,
  rightElement,
}: ScreenHeaderProps) {
  const navigation = useNavigation();

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
        <Icon name="menu-outline" size={28} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {showSearch ? (
        <TouchableOpacity style={styles.iconButton} onPress={onSearchPress}>
          <Icon name="search-outline" size={24} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconButton} />
      )}

      {rightElement}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#0f0f0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
