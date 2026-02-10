import { NextRequest, NextResponse } from "next/server";
import { setTokens } from "@/lib/auth.utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";

    const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Login failed" },
        { status: response.status }
      );
    }

    // Создаем ответ и устанавливаем cookies
    const nextResponse = NextResponse.json(data);
    
    // Используем утилиту для установки токенов
    return setTokens(nextResponse, data.access_token, data.refresh_token);

  } catch (error) {
    console.error("Login proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
