import { NextRequest, NextResponse } from "next/server";
import { forwardAuthedAuthAction } from "@/lib/authSession";

export async function POST(request: NextRequest) {
  let code = "";
  try {
    const body = await request.json();
    code = typeof body.code === "string" ? body.code.trim() : "";
  } catch {
    return NextResponse.json({ detail: "Noto'g'ri so'rov formati" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ detail: "Kod ko'rsatilmagan" }, { status: 400 });
  }
  return forwardAuthedAuthAction(
    request,
    "/api/v1/auth/telegram/link/poll",
    { code },
    { refreshSessionOnToken: true }
  );
}
