export const sidebarItems = [
	{ label: 'Моя страница', icon: '👤', href: '/feed/profile' },
	{ label: 'Новости', icon: '📰', href: '/feed' },
	{ label: 'Мессенджер', icon: '💬', href: '/feed/messages' },
	{ label: 'Блог', icon: '📝', href: '/feed/blog' },
	{ label: 'Соц. связи', icon: '👥', href: '/friends' },
	{ label: 'Магазин', icon: '🎁', href: '/shop' },
	// { label: 'Вондик Видео', icon: '🎬', href: '/video' }, // Temporarily disabled: Task 6
	/**
	 * TODO: Restore "Wondik Video" after release.
	 * 1. Uncomment the sidebar item above.
	 * 2. Ensure all /video routes and components are functional.
	 * 3. Verify video script/style loading if any were disabled.
	 */
	{ label: 'Тех. поддержка', icon: '🛟', href: '/feed/support' },
	{ label: 'Настройки', icon: '⚙️', href: '/feed/settings' },
]
