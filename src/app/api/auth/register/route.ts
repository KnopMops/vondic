import { NextRequest, NextResponse } from "next/server";
import { setTokens } from "@/lib/auth.utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";

    const response = await fetch(`${backendUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Registration failed" },
        { status: response.status }
      );
    }

    const nextResponse = NextResponse.json(data);
    
    // Если бэкенд возвращает токены при регистрации (мы это добавили)
    if (data.access_token && data.refresh_token) {
      return setTokens(nextResponse, data.access_token, data.refresh_token);
    }

    return nextResponse;

  } catch (error) {
    console.error("Registration proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
