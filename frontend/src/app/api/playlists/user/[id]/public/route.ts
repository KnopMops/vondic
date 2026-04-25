import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth.utils";
import { getBackendUrl } from "@/lib/server-urls";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const backendUrl = getBackendUrl();

    // This endpoint doesn't require authentication - public playlists
    const response = await fetch(`${backendUrl}/api/v1/playlists/user/${id}/public`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return NextResponse.json(data, { status: response.status });
      } catch {
        return NextResponse.json({ error: text || "Error fetching public playlists" }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Public playlists fetch proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
