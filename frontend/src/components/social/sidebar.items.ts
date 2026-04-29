import type { ComponentType } from 'react'
import {
	LuLifeBuoy as LifeBuoy,
	LuMessageCircle as MessageCircle,
	LuMusic as Music,
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
	{ label: 'Мессенджер', icon: MessageCircle, href: '/feed/messages' },
	{ label: 'Друзья', icon: Users, href: '/friends' },
	{ label: 'Магазин', icon: ShoppingBag, href: '/shop' },
	{ label: 'VМьюзик', icon: Music, href: '/feed/music' },

	{ label: 'Тех. поддержка', icon: LifeBuoy, href: '/feed/support' },
	{ label: 'Настройки', icon: Settings, href: '/feed/settings' },
]
