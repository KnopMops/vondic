import type { ComponentType } from 'react'
import {
	LuMail as Mail,
	LuMessageCircle as MessageCircle,
	LuMusic as Music,
	LuLandmark as Landmark,
	LuNewspaper as Newspaper,
	LuSettings as Settings,
	LuShoppingBag as ShoppingBag,
	LuUser as User,
	LuUsers as Users,
} from 'react-icons/lu'

type SidebarItem = {
	label: string
	href: string
	icon: ComponentType<{ className?: string }>
}

export const sidebarItems: SidebarItem[] = [
	{ label: 'Моя страница', icon: User, href: '/feed/profile' },
	{ label: 'Новости', icon: Newspaper, href: '/feed' },
	{ label: 'Сообщества', icon: Landmark, href: '/feed/communities' },
	{ label: 'Мессенджер', icon: MessageCircle, href: '/feed/messages' },
	{ label: 'Почта', icon: Mail, href: '/feed/mail' },
	{ label: 'Друзья', icon: Users, href: '/friends' },
	{ label: 'Магазин', icon: ShoppingBag, href: '/shop' },
	{ label: 'VМьюзик', icon: Music, href: '/feed/music' },
	{ label: 'Настройки', icon: Settings, href: '/feed/settings' },
]
