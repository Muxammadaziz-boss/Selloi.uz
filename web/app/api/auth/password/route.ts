import { NextRequest, NextResponse } from "next/server";
import { forwardAuthedAuthAction } from "@/lib/authSession";

export async function POST(request: NextRequest) {
  let body: { current_password?: string; new_password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Noto'g'ri so'rov formati" }, { status: 400 });
  }

  const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";

  if (newPassword.trim().length < 6) {
    return NextResponse.json(
      { detail: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak" },
      { status: 400 }
    );
  }

  return forwardAuthedAuthAction(
    request,
    "/api/v1/auth/change-password",
    { current_password: currentPassword, new_password: newPassword },
    { refreshSessionOnToken: true }
  );
}
