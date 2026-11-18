"use client";

import React, { useState } from "react";
import { DEMO_SCENARIOS } from "./data";
import { Send, CheckCheck, Camera, CheckCircle2, ShoppingBag, Bot } from "lucide-react";

export default function InteractiveDemo() {
  const [activeScenarioId, setActiveScenarioId] = useState(DEMO_SCENARIOS[0].id);

  const scenario =
    DEMO_SCENARIOS.find((s) => s.id === activeScenarioId) || DEMO_SCENARIOS[0];

  return (
    <section className="selloi-section position-relative">
      <div className="selloi-container">
        {/* Section Header */}
        <div className="text-center mb-5">
          <div className="mb-3">
            <span className="selloi-pill-badge">
              <Bot size={13} color="#C084FC" />
              <span>INTERAKTIV DEMO</span>
            </span>
          </div>
          <h2 className="selloi-section-title mb-3 text-white">
            Selloi AI qanday ishlashini o‘zingiz sinab ko‘ring
          </h2>
          <p
            className="text-secondary mx-auto"
            style={{ maxWidth: "600px", fontSize: "1.08rem", color: "#CBD5E1" }}
          >
            Haqiqiy xaridor vaziyatini tanlang va botning tezkor, muloyim javobini ko‘ring.
          </p>
        </div>

        {/* Interactive Widget Container */}
        <div
          className="mx-auto rounded-4 overflow-hidden"
          style={{
            maxWidth: "860px",
            background: "#0E1019",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
          }}
        >
          {/* Scenario Tabs Header */}
          <div
            className="p-3 d-flex flex-wrap gap-2 border-bottom border-secondary border-opacity-25"
            style={{ background: "#131522" }}
          >
            {DEMO_SCENARIOS.map((sc) => {
              const isActive = sc.id === activeScenarioId;
              return (
                <button
                  key={sc.id}
                  onClick={() => setActiveScenarioId(sc.id)}
                  className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 rounded-2 ${
                    isActive
                      ? "btn-primary text-white"
                      : "btn-dark text-light border border-secondary border-opacity-25"
                  }`}
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    background: isActive ? "#7C3AED" : "transparent",
                    borderColor: isActive ? "#7C3AED" : undefined,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{sc.icon}</span>
                  <span>{sc.tabLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Telegram Simulator Chat Area */}
          <div className="p-4 p-md-5">
            {/* Bot Top bar */}
            <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom border-secondary border-opacity-25">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center text-white fw-bold"
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: "#7C3AED",
                    fontSize: "0.95rem",
                  }}
                >
                  S
                </div>
                <div>
                  <div className="fw-bold text-white" style={{ fontSize: "0.95rem" }}>
                    Selloi AI Assistant
                  </div>
                  <div className="small text-info d-flex align-items-center gap-1.5" style={{ fontSize: "0.75rem" }}>
                    <span
                      className="d-inline-block rounded-circle bg-success"
                      style={{ width: "6px", height: "6px" }}
                    />
                    bot • 24/7 onlayn
                  </div>
                </div>
              </div>
              <span className="badge bg-purple-subtle text-purple border border-purple-subtle" style={{ fontSize: "0.72rem" }}>
                Jonli sinov
              </span>
            </div>

            {/* Messages Container */}
            <div className="d-flex flex-column gap-3">
              {/* User message */}
              <div className="d-flex justify-content-end">
                <div
                  className="p-3 px-3.5"
                  style={{
                    maxWidth: "80%",
                    background: "#2A2050",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    borderRadius: "16px 16px 3px 16px",
                    color: "#FFFFFF",
                    fontSize: "0.92rem",
                    lineHeight: 1.5,
                  }}
                >
                  {scenario.userHasImage && (
                    <div
                      className="p-2 mb-2 rounded-2 d-flex align-items-center gap-2"
                      style={{ background: "#161826", border: "1px dashed rgba(255,255,255,0.2)" }}
                    >
                      <Camera size={16} color="#38BDF8" />
                      <span className="small text-info" style={{ fontSize: "0.8rem" }}>{scenario.userImageDesc}</span>
                    </div>
                  )}
                  <div>{scenario.userMessage}</div>
                  <div className="d-flex align-items-center justify-content-end gap-1 mt-1 text-white-50 small" style={{ fontSize: "0.68rem" }}>
                    <span>12:44</span>
                    <CheckCheck size={13} color="#38BDF8" />
                  </div>
                </div>
              </div>

              {/* AI Response message */}
              <div className="d-flex align-items-start gap-2.5">
                <div
                  className="d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    background: "#7C3AED",
                    color: "#FFFFFF",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  S
                </div>
                <div
                  className="p-3 px-3.5"
                  style={{
                    maxWidth: "85%",
                    background: "#141624",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "16px 16px 16px 3px",
                    color: "#F1F5F9",
                    fontSize: "0.92rem",
                    lineHeight: 1.5,
                  }}
                >
                  <div>{scenario.aiResponse}</div>
                  <div className="d-flex align-items-center justify-content-between gap-3 mt-2 pt-1 border-top border-secondary border-opacity-25">
                    <span className="badge bg-purple-subtle text-purple" style={{ fontSize: "0.7rem" }}>
                      <ShoppingBag size={10} className="me-1" /> Avtomatik javob
                    </span>
                    <span className="small text-secondary" style={{ fontSize: "0.68rem" }}>12:44</span>
                  </div>
                </div>
              </div>

              {/* Order Card if present */}
              {scenario.hasOrderCard && scenario.orderData && (
                <div
                  className="p-3 px-3.5 rounded-3 mt-2"
                  style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    maxWidth: "85%",
                    marginLeft: "40px",
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-success border-opacity-25">
                    <span className="fw-bold text-success d-flex align-items-center gap-1.5" style={{ fontSize: "0.85rem" }}>
                      <CheckCircle2 size={15} /> {scenario.orderData.title}
                    </span>
                    <span className="badge bg-success text-white" style={{ fontSize: "0.65rem" }}>
                      {scenario.orderData.status}
                    </span>
                  </div>
                  <div className="d-flex flex-column gap-1 small text-light" style={{ fontSize: "0.8rem" }}>
                    <div><strong>Tovar:</strong> {scenario.orderData.item}</div>
                    <div><strong>Narx:</strong> <span className="text-success fw-bold">{scenario.orderData.price}</span></div>
                    <div><strong>Yetkazish:</strong> {scenario.orderData.size}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar Placeholder */}
            <div
              className="mt-4 p-2 px-3 rounded-3 d-flex align-items-center justify-content-between"
              style={{
                background: "#080911",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <span className="text-secondary small ps-2" style={{ fontSize: "0.82rem" }}>
                Yuqoridagi ssenariylardan birini tanlang yoki o‘zingiz do‘kon ochib sinang...
              </span>
              <div
                className="d-flex align-items-center justify-content-center rounded-2"
                style={{ width: "30px", height: "30px", background: "#7C3AED", color: "#FFFFFF" }}
              >
                <Send size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
