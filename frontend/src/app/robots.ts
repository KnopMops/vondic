import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
	const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://vondic.ru'

	return {
		rules: [
			{
				userAgent: '*',
				allow: [
					'/',
				],
				disallow: [
					'/api/',
					'/feed/admin/'
				]
			},
			{
				userAgent: 'YandexBot',
				allow: '/',
				disallow: '/feed/admin/',
				crawlDelay: 1
			}
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	}
}