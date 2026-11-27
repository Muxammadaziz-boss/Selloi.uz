import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetch(`${backendUrl}/api/v1/demo/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Demo xizmatiga ulanib bo'lmadi" }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const sessionId = (request.nextUrl.searchParams.get("session_id") || "").trim();
  const afterSeq = request.nextUrl.searchParams.get("after_seq") || "0";
  if (!sessionId) {
    return NextResponse.json({ detail: "session_id ko'rsatilmagan" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${backendUrl}/api/v1/demo/session/${encodeURIComponent(sessionId)}?after_seq=${encodeURIComponent(afterSeq)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Demo holatini olishda xatolik" }, { status: 502 });
  }
}
