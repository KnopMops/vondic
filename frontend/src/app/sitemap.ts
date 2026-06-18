import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://vondic.ru'

	const staticRoutes: MetadataRoute.Sitemap = [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 1.0,
		},
		{
			url: `${baseUrl}/feed`,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 0.9,
		},
		{
			url: `${baseUrl}/feed/messages`,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 0.8,
		},
		{
			url: `${baseUrl}/feed/music`,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 0.6,
		},
		{
			url: `${baseUrl}/feed/mail`,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 0.1,
		},
		{
			url: `${baseUrl}/feed/support`,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 0.1,
		},
	]

	return staticRoutes
}