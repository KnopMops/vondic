import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth.utils";
import { getBackendUrl } from "@/lib/server-urls";

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const backendUrl = getBackendUrl();

    const payload = { ...body, access_token: token };

    const response = await fetch(`${backendUrl}/api/v1/users/block-user`, {
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
            return NextResponse.json({ error: text }, { status: response.status });
        }
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
