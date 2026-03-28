'use client'

import { ErrorPage } from '@/components/ErrorPage'
import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <ErrorPage
            code={500}
            title="Что-то пошло не так"
            message="У нас случилась небольшая авария в машинном отделении. Наши инженеры уже вовсю машут гаечными ключами."
        />
    )
}
