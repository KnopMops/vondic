import { NextRequest, NextResponse } from "next/server";
import { clearTokens } from "@/lib/auth.utils";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ message: "Logged out" });
  return clearTokens(response);
}
