import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, withAccessTokenRefresh } from "@/lib/auth.utils";
import { getBackendUrl } from "@/lib/server-urls";

export async function GET(req: NextRequest) {
  return withAccessTokenRefresh(req, async (token) => {
    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/v1/playlists/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return NextResponse.json(data, { status: response.status });
      } catch {
        return NextResponse.json({ error: text || "Error fetching playlists" }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  });
}

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/v1/playlists/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return NextResponse.json(data, { status: response.status });
      } catch {
        return NextResponse.json({ error: text || "Error creating playlist" }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Playlist create proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
