'use client'

import React from 'react'
import { CallPanel } from './CallPanel'

interface IntegratedCallPanelProps {
    onClose?: () => void
}

export const IntegratedCallPanel: React.FC<IntegratedCallPanelProps> = ({
    onClose,
}) => {
    // IntegratedCallPanel теперь использует CallPanel с возможностью изменения размера
    // Это упрощённая версия для интеграции
    return <CallPanel onClose={onClose} />
}
