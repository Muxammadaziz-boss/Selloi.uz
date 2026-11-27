import { NextRequest, NextResponse } from "next/server";
import { forwardAuthedAuthAction, isRealEmailClient } from "@/lib/authSession";

export async function POST(request: NextRequest) {
  let body: { email?: string; code?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Noto'g'ri so'rov formati" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!isRealEmailClient(email)) {
    return NextResponse.json({ detail: "Haqiqiy email manzilini kiriting" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ detail: "6 xonali tasdiqlash kodini kiriting" }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ detail: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, { status: 400 });
  }

  return forwardAuthedAuthAction(
    request,
    "/api/v1/auth/bind-email/confirm",
    password ? { email, code, password } : { email, code },
    { refreshSessionOnToken: true }
  );
}
