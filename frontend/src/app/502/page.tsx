import { ErrorPage } from '@/components/ErrorPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: '502 - Плохой шлюз | Вондик',
    description: 'Один из наших серверов временно не отвечает.',
}

export default function BadGateway() {
    return (
        <ErrorPage
            code={502}
            title="Сервер спит..."
            message="Похоже, один из наших серверов решил вздремнуть. Мы его уже аккуратно будим чашечкой кофе."
        />
    )
}
