"use client";

import { useRef } from "react";

export function OtpInputs({
  value,
  invalid,
  disabled,
  autoFocus,
  onChange,
  onComplete,
}: {
  value: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
}) {
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    const code = next.join("").slice(0, 6);
    onChange(code);
    if (code.length === 6) onComplete?.(code);
  };

  return (
    <div className="otp-inputs" aria-label="Email verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          className={`otp-input${digit ? " filled" : ""}${invalid ? " otp-invalid" : ""}`}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0}
          maxLength={1}
          aria-label={`Digit ${index + 1}`}
          disabled={disabled}
          value={digit}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(-1);
            setDigit(index, next);
            if (next && index < 5) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.length === 6) {
              event.preventDefault();
              onComplete?.(value);
            }
            if (event.key === "Backspace" && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
            if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
            if (event.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            onChange(pasted);
            refs.current[Math.min(pasted.length, 5)]?.focus();
            if (pasted.length === 6) onComplete?.(pasted);
          }}
        />
      ))}
    </div>
  );
}
