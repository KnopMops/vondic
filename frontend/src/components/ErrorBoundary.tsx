'use client'

import React from 'react'

interface Props {
	children: React.ReactNode
}

interface State {
	hasError: boolean
}

export default class ErrorBoundary extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(): State {
		return { hasError: true }
	}

	render() {
		if (this.state.hasError) {
			return null
		}
		return this.props.children
	}
}
