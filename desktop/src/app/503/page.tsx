import { ErrorPage } from '@/components/ErrorPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: '503 - Сервис недоступен | Вондик',
    description: 'Наши серверы временно перегружены.',
}

export default function ServiceUnavailable() {
    return (
        <ErrorPage
            code={503}
            title="Очередь за мороженым"
            message="Наши серверы сейчас слишком популярны. Пожалуйста, подождите немного, пока мы расширяем проход."
        />
    )
}
