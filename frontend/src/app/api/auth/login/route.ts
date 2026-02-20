import { NextRequest, NextResponse } from "next/server";
import { setTokens } from "@/lib/auth.utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";
    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const realIp = req.headers.get("x-real-ip") || "";

    const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": userAgent,
        "X-Forwarded-For": forwardedFor,
        "X-Real-IP": realIp,
      },
      body: JSON.stringify(body),
    });

  const text = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text || "Login failed" };
  }

    if (!response.ok) {
    // Пробрасываем two_factor_required и method, если они есть
    if (data.two_factor_required) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json({ error: data.error || "Login failed" }, { status: response.status });
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
