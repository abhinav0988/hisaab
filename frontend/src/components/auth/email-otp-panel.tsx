"use client";

import { Button } from "@hisaab/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { OtpInputs } from "@/components/auth/otp-inputs";
import { authService } from "@/services/auth.service";

export function EmailOtpPanel({
  email,
  verified,
  autoSend = false,
  verifiedHint = "Your account can now be registered with this email.",
  children,
  onVerified,
  onReset,
}: {
  email: string;
  verified: boolean;
  autoSend?: boolean;
  verifiedHint?: string;
  children: ReactNode;
  onVerified: () => void | Promise<void>;
  onReset: () => void;
}) {
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const autoSent = useRef(false);

  useEffect(() => {
    setSent(false);
    setCode("");
    setError("");
    setInvalid(false);
    setSeconds(0);
  }, [email]);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address first");
      return;
    }
    setSending(true);
    setInvalid(false);
    setError("");
    setCode("");
    try {
      await authService.sendVerificationCode(email);
      setSent(true);
      setSeconds(60);
      toast.success("Verification code sent to your email");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to send verification code.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!autoSend || verified || autoSent.current || sending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return;
    autoSent.current = true;
    void send();
  }, [autoSend, email, verified, sending]);

  const verify = async (nextCode = code) => {
    if (nextCode.length !== 6) {
      setInvalid(true);
      setError("Enter the complete 6-digit verification code.");
      return;
    }
    setVerifying(true);
    setInvalid(false);
    setError("");
    try {
      await authService.verifyEmailCode(email, nextCode);
      await onVerified();
      toast.success("Email verified successfully");
    } catch (cause) {
      setInvalid(true);
      setError(
        cause instanceof Error
          ? cause.message
          : "The verification code is incorrect or expired. Please try again.",
      );
    } finally {
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <>
        <div className="verify-email-row">{children}</div>
        <div className="email-verified-status">
          <span className="verified-check" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          <div>
            <b>Email verified</b>
            <small>{verifiedHint}</small>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setSent(false);
              setCode("");
              onReset();
            }}
          >
            Change
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="verify-email-row">
        {children}
        <Button
          type="button"
          variant="secondary"
          className="email-code-btn"
          disabled={sending}
          onClick={() => void send()}
        >
          <span className="email-code-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 6h16v12H4z" />
              <path d="m4 7 8 6 8-6" />
            </svg>
          </span>
          <span>{sending ? "Sending..." : sent ? "Send again" : "Send code"}</span>
        </Button>
      </div>
      {sent ? (
        <div className="email-verify-card">
          <div className="email-verify-head">
            <div className="verify-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 6h16v12H4z" />
                <path d="m4 7 8 6 8-6" />
                <path d="M17 4v4" />
              </svg>
            </div>
            <div>
              <b>Verify your email</b>
              <small>Enter the 6-digit code sent to {email}.</small>
            </div>
            <span className="verify-step">Required</span>
          </div>
          <OtpInputs
            value={code}
            invalid={invalid}
            disabled={verifying}
            autoFocus
            onChange={(next) => {
              setCode(next);
              setInvalid(false);
              setError("");
            }}
            onComplete={() => {
              document.querySelector<HTMLButtonElement>(".verify-code-btn")?.focus();
            }}
          />
          {error ? <p className="otp-error">{error}</p> : null}
          <div className="email-verify-actions">
            <Button
              type="button"
              className="verify-code-btn"
              disabled={verifying}
              onClick={() => void verify()}
            >
              {verifying ? "Verifying..." : "Verify email"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="resend-code-btn"
              disabled={sending || seconds > 0}
              onClick={() => void send()}
            >
              {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
            </Button>
          </div>
          <small className="email-security-note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 5 6v5c0 4.4 2.8 8.2 7 10 4.2-1.8 7-5.6 7-10V6z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            We verify your email with a 6-digit code before your Hisaab workspace opens.
          </small>
        </div>
      ) : null}
    </>
  );
}
