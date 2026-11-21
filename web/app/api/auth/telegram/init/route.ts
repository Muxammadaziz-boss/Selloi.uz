import { NextResponse } from "next/server";

export async function POST() {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  try {
    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/telegram/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({}));
      return NextResponse.json(
        { detail: err.detail || "Telegram avtorizatsiya sessiyasini yaratishda xatolik" },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json({
      ok: true,
      code: data.code,
      bot_username: data.bot_username,
      bot_url: data.bot_url,
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: "Server bilan bog'lanishda xatolik: " + err.message },
      { status: 500 }
    );
  }
}
