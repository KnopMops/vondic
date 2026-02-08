import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth.utils";

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";

    const payload = { ...body, access_token: token };

    const response = await fetch(`${backendUrl}/api/v1/friends/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        try {
            const data = JSON.parse(text);
             return NextResponse.json(data, { status: response.status });
        } catch {
             return NextResponse.json({ error: text || "Error removing friend" }, { status: response.status });
        }
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Friends remove proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
