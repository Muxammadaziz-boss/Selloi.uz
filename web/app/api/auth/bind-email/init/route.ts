import { NextRequest, NextResponse } from "next/server";
import { forwardAuthedAuthAction, isRealEmailClient } from "@/lib/authSession";

export async function POST(request: NextRequest) {
  let email = "";
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ detail: "Noto'g'ri so'rov formati" }, { status: 400 });
  }
  if (!isRealEmailClient(email)) {
    return NextResponse.json({ detail: "Haqiqiy email manzilini kiriting" }, { status: 400 });
  }
  return forwardAuthedAuthAction(request, "/api/v1/auth/bind-email/init", { email });
}
