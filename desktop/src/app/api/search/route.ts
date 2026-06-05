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

    const response = await fetch(`${backendUrl}/api/v1/search`, {
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
             return NextResponse.json({ error: text || "Error searching" }, { status: response.status });
        }
    }

    const data = await response.json();

    // Enrich posts with user data if type is 'posts'
    if (data.type === 'posts' && Array.isArray(data.results)) {
        try {
            // Fetch all users to enrich data
            const usersResponse = await fetch(`${backendUrl}/api/v1/users/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            let usersMap: Record<string, any> = {};
            if (usersResponse.ok) {
                const users = await usersResponse.json();
                if (Array.isArray(users)) {
                    users.forEach((u: any) => {
                        usersMap[u.id] = u;
                    });
                }
            }

            data.results = data.results.map((post: any) => {
                const authorId = post.posted_by;
                const author = usersMap[authorId];
                if (author) {
                    return {
                        ...post,
                        author: author 
                    };
                }
                return post;
            });
        } catch (enrichError) {
            console.error("Error enriching search results:", enrichError);
            // Continue without enrichment if fails
        }
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Global search proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
