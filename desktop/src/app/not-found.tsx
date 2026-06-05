import { ErrorPage } from '@/components/ErrorPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: '404 - Страница не найдена | Вондик',
    description: 'Запрашиваемая страница не существует.',
}

export default function NotFound() {
    return (
        <ErrorPage
            code={404}
            title="Ой, потерялись?"
            message="Похоже, эта страница ушла в другое измерение. Мы уже ищем её с фонариками."
        />
    )
}
