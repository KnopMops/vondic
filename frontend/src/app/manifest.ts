import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: 'Вондик',
		short_name: 'Вондик',
		description: 'Универсальный коммуникационный хаб',
		start_url: '/',
		display: 'standalone',
		icons: [
			{
				src: '/favicon.ico',
				sizes: '48x48',
				type: 'image/x-icon',
			},
		],
	}
}