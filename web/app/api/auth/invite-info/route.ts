import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ detail: "Token ko'rsatilmagan" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${backendUrl.replace(/\/$/, "")}/api/v1/auth/invite-info?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || "Server bilan bog'lanishda xatolik" },
      { status: 500 }
    );
  }
}
