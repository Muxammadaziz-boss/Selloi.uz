import { NextRequest } from "next/server";
import { forwardAuthedAuthAction } from "@/lib/authSession";

export async function POST(request: NextRequest) {
  return forwardAuthedAuthAction(request, "/api/v1/auth/telegram/link/init", {});
}
