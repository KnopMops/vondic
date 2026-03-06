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

    // 1. Fetch requests
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

    // 2. Fetch all users to enrich data (since requests might miss avatar/details)
    // In a production app, we should fetch only specific users by ID, but the API might not support it yet.
    const usersResponse = await fetch(`${backendUrl}/api/v1/users/`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            // Pass token if needed for users endpoint, though usually public or protected
            'Authorization': `Bearer ${token}` 
        }
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

    // 3. Enrich requests
    const enrichedRequests = requests.map((req: any) => {
        // Assume req has requester_id or similar, or it IS the user object but missing fields
        // If req has 'id' that matches a user, use it. 
        // Or if req has 'requester_id'
        const userId = req.requester_id || req.id;
        const userDetails = usersMap[userId];

        if (userDetails) {
            return {
                ...req,
                ...userDetails, // Overwrite with full user details
                avatar_url: userDetails.avatar_url || req.avatar_url,
                username: userDetails.username || req.username,
                email: userDetails.email || req.email
            };
        }
        return req;
    });

    return NextResponse.json(enrichedRequests);

  } catch (error) {
    console.error("Friends requests proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
