import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth.utils";
import { getBackendUrl } from "@/lib/server-urls";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/v1/playlists/${id}`, {
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
        return NextResponse.json({ error: text || "Error fetching playlist" }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Playlist fetch proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const response = await fetch(`${backendUrl}/api/v1/playlists/${id}`, {
      method: "PUT",
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
        return NextResponse.json({ error: text || "Error updating playlist" }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Playlist update proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/v1/playlists/${id}`, {
      method: "DELETE",
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
        return NextResponse.json({ error: text || "Error deleting playlist" }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Playlist delete proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
