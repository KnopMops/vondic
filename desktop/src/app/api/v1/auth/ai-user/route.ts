import { NextResponse } from 'next/server'

export async function GET() {
	return NextResponse.json({ error: 'AI Assistant disabled' }, { status: 404 })
}
