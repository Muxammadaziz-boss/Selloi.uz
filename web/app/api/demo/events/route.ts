import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const sessionId = (request.nextUrl.searchParams.get("session_id") || "").trim();
  if (!sessionId) {
    return NextResponse.json({ detail: "session_id ko'rsatilmagan" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/v1/demo/events/${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        signal: request.signal,
      }
    );

    if (!response.ok || !response.body) {
      return NextResponse.json({ detail: "Real-vaqt oqimi topilmadi" }, { status: response.status || 502 });
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({ detail: "SSE oqimiga ulanib bo'lmadi" }, { status: 502 });
  }
}
