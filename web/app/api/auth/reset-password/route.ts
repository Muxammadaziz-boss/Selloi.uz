import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  let body: { email?: string; code?: string; new_password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "So'rov ma'lumotlari noto'g'ri" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ detail: "To'g'ri email manzil kiriting" }, { status: 400 });
  }
  if (!code || code.length < 6) {
    return NextResponse.json({ detail: "6 xonali tasdiqlash kodini kiriting" }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ detail: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak" }, { status: 400 });
  }

  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || "Server bilan bog'lanishda xatolik" },
      { status: 500 }
    );
  }
}
