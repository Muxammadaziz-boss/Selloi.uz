import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const realIp = request.headers.get("x-real-ip") || forwardedFor.split(",")[0].trim() || "127.0.0.1";
  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetch(`${backendUrl}/api/v1/demo/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Real-IP": realIp,
        "X-Forwarded-For": realIp,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Buyurtmani yuborishda xatolik" }, { status: 502 });
  }
}
