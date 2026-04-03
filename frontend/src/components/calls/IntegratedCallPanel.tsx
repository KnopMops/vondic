'use client'

import React from 'react'
import { CallPanel } from './CallPanel'

interface IntegratedCallPanelProps {
    onClose?: () => void
}

export const IntegratedCallPanel: React.FC<IntegratedCallPanelProps> = ({
    onClose,
}) => {
    
    
    return <CallPanel onClose={onClose} />
}
