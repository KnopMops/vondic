import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth.utils";
import { getBackendUrl } from "@/lib/server-urls";

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const backendUrl = getBackendUrl();

    const payload = { ...body, access_token: token };

    
    const response = await fetch(`${backendUrl}/api/v1/friends/requests`, {
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
             return NextResponse.json({ error: text || "Error fetching requests" }, { status: response.status });
        }
    }

    const requestsData = await response.json();
    const requests = Array.isArray(requestsData) ? requestsData : [];

    const sanitized = requests.map((req: any) => {
      if (req.privacy_settings?.show_email === true) {
        return req;
      }
      const { email: _e, ...rest } = req;
      return rest;
    });

    return NextResponse.json(sanitized);

  } catch (error) {
    console.error("Friends requests proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
