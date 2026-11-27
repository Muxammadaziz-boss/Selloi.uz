"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface InviteInfo {
  valid: boolean;
  email: string;
  role: string;
  organization_id: number;
  organization_name: string;
  requires_registration: boolean;
  expires_at?: string | null;
}

function InviteAcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Taklifnoma tokeni topilmadi.");
      setLoading(false);
      return;
    }
    let active = true;
    fetch(`/api/auth/invite-info?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Taklifnoma yaroqsiz");
        if (active) setInfo(data);
      })
      .catch((err: any) => {
        if (active) setError(err?.message || "Taklifnoma topilmadi");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          full_name: fullName.trim(),
          password: password || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Taklifnomani qabul qilib bo'lmadi");
      if (data.organization_id && typeof window !== "undefined") {
        localStorage.setItem("active_org_id", String(data.organization_id));
        sessionStorage.setItem("active_org_id", String(data.organization_id));
      }
      router.push(data.redirect || "/dashboard");
    } catch (err: any) {
      setError(err?.message || "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: "var(--bg-canvas, #0d0e11)", color: "var(--text-primary, #f5f5f7)" }}
    >
      <div
        className="linear-card p-4 w-100"
        style={{
          maxWidth: 440,
          backgroundColor: "var(--bg-surface, #16181d)",
          border: "1px solid var(--border-default, #2a2d36)",
          borderRadius: "12px",
        }}
      >
        <div className="mb-3">
          <div className="small text-secondary mb-1">Selloi Jamoa Taklifnomasi</div>
          <h1 className="h5 fw-bold mb-1">Jamoaga Qo&apos;shilish</h1>
        </div>

        {loading && <div className="text-secondary small py-4 text-center">Taklifnoma tekshirilmoqda...</div>}

        {!loading && error && (
          <div className="p-3 rounded-2 mb-3 small" style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#f87171" }}>
            {error}
          </div>
        )}

        {!loading && info && (
          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            <div
              className="p-3 rounded-2 small"
              style={{
                backgroundColor: "var(--bg-surface-elevated, #1d2027)",
                border: "1px solid var(--border-subtle, #262932)",
              }}
            >
              <div><strong>Do&apos;kon:</strong> {info.organization_name}</div>
              <div><strong>Email:</strong> {info.email}</div>
              <div><strong>Rol:</strong> <span className="text-uppercase">{info.role}</span></div>
            </div>

            {info.requires_registration && (
              <div>
                <label className="small text-secondary d-block mb-1">Ism-familiyangiz</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masalan: Dilshod Karimov"
                  className="linear-input w-100"
                />
              </div>
            )}

            <div>
              <label className="small text-secondary d-block mb-1">
                {info.requires_registration
                  ? "Yangi parol (kamida 6 belgi)"
                  : "Hisobingiz paroli (tasdiqlash uchun)"}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="linear-input w-100"
              />
            </div>

            <button type="submit" disabled={submitting} className="btn-linear btn-primary w-100 py-2">
              {submitting ? "Tasdiqlanmoqda..." : "Taklifni qabul qilish va kirish"}
            </button>
          </form>
        )}

        <div className="text-center mt-3 small">
          <Link href="/login" className="text-secondary text-decoration-none">
            Kirish sahifasiga qaytish
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-vh-100 d-flex align-items-center justify-content-center">Yuklanmoqda...</div>}>
      <InviteAcceptContent />
    </Suspense>
  );
}
