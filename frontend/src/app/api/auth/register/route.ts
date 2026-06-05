import { setTokens } from "@/lib/auth.utils";
import { getBackendUrl } from "@/lib/server-urls";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.email && typeof body.email === "string") {
      body.email = body.email.trim().toLowerCase();
    }
    if (body?.username && typeof body.username === "string") {
      body.username = body.username.trim();
    }
    const backendUrl = getBackendUrl();
    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const realIp = req.headers.get("x-real-ip") || "";

    const response = await fetch(`${backendUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": userAgent,
        "X-Forwarded-For": forwardedFor,
        "X-Real-IP": realIp,
      },
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
