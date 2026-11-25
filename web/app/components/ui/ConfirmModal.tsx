"use client";

import React from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}

/**
 * Reusable Selloi-styled confirmation dialog replacing native window.confirm().
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Amalni tasdiqlang",
  message,
  confirmText = "Tasdiqlash",
  cancelText = "Bekor qilish",
  variant = "danger",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      size="sm"
      title={
        <div className="d-flex align-items-center gap-2">
          <span
            className="d-inline-flex align-items-center justify-content-center rounded-2"
            style={{
              width: 30,
              height: 30,
              backgroundColor: variant === "danger" ? "var(--danger-subtle)" : "var(--accent-subtle)",
              border: `1px solid ${variant === "danger" ? "var(--danger-border)" : "var(--accent-border)"}`,
              color: variant === "danger" ? "var(--danger-text)" : "var(--accent-text)",
            }}
          >
            <IconAlertTriangle size={16} />
          </span>
          <span>{title}</span>
        </div>
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant} size="sm" onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="mb-0 text-secondary" style={{ fontSize: "0.9rem", lineHeight: 1.55 }}>
        {message}
      </p>
    </Modal>
  );
}
