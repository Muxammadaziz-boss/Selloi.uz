import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, buildVerifiedSessionPayload } from "@/lib/authSession";

export async function POST(request: NextRequest) {
  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  if (!secret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  let body: { token?: string; full_name?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Noto'g'ri so'rov formati" }, { status: 400 });
  }

  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const { payload } = await buildVerifiedSessionPayload({
      backendUrl,
      backendToken: data.access_token,
      userId: data.user_id,
      email: data.email,
      fullName: data.full_name,
      organizationId: data.organization_id,
    });

    const response = NextResponse.json({
      ok: true,
      redirect: "/dashboard",
      organization_id: data.organization_id,
      role: data.role,
    });
    attachSessionCookie(response, payload, secret);
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || "Server bilan bog'lanishda xatolik" },
      { status: 500 }
    );
  }
}
