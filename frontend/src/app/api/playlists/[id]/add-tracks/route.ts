import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth.utils";
import { getBackendUrl } from "@/lib/server-urls";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/v1/playlists/${id}/add-tracks`, {
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
        return NextResponse.json({ error: text || "Error adding tracks" }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Add tracks proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
