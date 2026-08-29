type WaitUntilContext = { waitUntil(promise: Promise<unknown>): void };

function withAppCallback(env: Env, url: string) {
  try {
    const parsed = new URL(url);
    const callback = parsed.searchParams.get("callbackURL");
    if (!callback || !callback.startsWith("http")) {
      parsed.searchParams.set("callbackURL", `${env.APP_ORIGIN.replace(/\/$/, "")}/dashboard`);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function emailCopy(kind: "verification" | "password-reset" | "otp", url: string) {
  if (kind === "otp") {
    return {
      subject: "Your Hisaab verification code",
      text: `Your Hisaab verification code is ${url}. It expires in 10 minutes.\n\nIf you did not create a Hisaab account, you can ignore this email.`,
      html: `<div style="font-family:Plus Jakarta Sans,Arial,sans-serif;background:#f5f7f3;padding:32px">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;border:1px solid #dfe7e0">
          <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.12em;color:#0f5134">HISAAB</p>
          <h1 style="margin:0 0 12px;font-size:28px;letter-spacing:-.04em;color:#13261c">Verify your email</h1>
          <p style="margin:0 0 24px;color:#6d7d73;line-height:1.6">Enter this 6-digit code to confirm your inbox before your Hisaab account is created.</p>
          <p style="margin:0 0 8px;font-size:36px;font-weight:800;letter-spacing:.28em;color:#0f5134">${url}</p>
          <p style="margin:24px 0 0;font-size:12px;color:#91a097;line-height:1.6">This code expires in 10 minutes. If you did not create a Hisaab account, you can ignore this email.</p>
        </div>
      </div>`,
    };
  }
  if (kind === "verification") {
    return {
      subject: "Verify your Hisaab email",
      text: `Confirm your Hisaab account by opening this link:\n${url}\n\nThis link expires in one hour.`,
      html: `<div style="font-family:Plus Jakarta Sans,Arial,sans-serif;background:#f5f7f3;padding:32px">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;border:1px solid #dfe7e0">
          <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.12em;color:#0f5134">HISAAB</p>
          <h1 style="margin:0 0 12px;font-size:28px;letter-spacing:-.04em;color:#13261c">Verify your email</h1>
          <p style="margin:0 0 24px;color:#6d7d73;line-height:1.6">Confirm this address to finish creating your private money space.</p>
          <a href="${url}" style="display:inline-block;background:#0f5134;color:#fff;text-decoration:none;font-weight:800;border-radius:14px;padding:14px 18px">Verify email</a>
          <p style="margin:24px 0 0;font-size:12px;color:#91a097;line-height:1.6">This link expires in one hour. If you did not create a Hisaab account, you can ignore this email.</p>
        </div>
      </div>`,
    };
  }
  return {
    subject: "Reset your Hisaab password",
    text: `Reset your Hisaab password using this link:\n${url}\n\nThis link expires in one hour.`,
    html: `<div style="font-family:Plus Jakarta Sans,Arial,sans-serif;background:#f5f7f3;padding:32px">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;border:1px solid #dfe7e0">
        <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.12em;color:#0f5134">HISAAB</p>
        <h1 style="margin:0 0 12px;font-size:28px;letter-spacing:-.04em;color:#13261c">Reset your password</h1>
        <p style="margin:0 0 24px;color:#6d7d73;line-height:1.6">Use this secure link to choose a new password. If you did not ask for a reset, you can ignore this email.</p>
        <a href="${url}" style="display:inline-block;background:#0f5134;color:#fff;text-decoration:none;font-weight:800;border-radius:14px;padding:14px 18px">Reset password</a>
        <p style="margin:24px 0 0;font-size:12px;color:#91a097;line-height:1.6">This link expires in one hour.</p>
      </div>
    </div>`,
  };
}

export async function sendAuthEmail(
  env: Env,
  ctx: WaitUntilContext,
  kind: "verification" | "password-reset" | "otp",
  to: string,
  url: string,
) {
  const link = kind === "otp" ? url : withAppCallback(env, url);
  if (env.AUTH_DEV_EXPOSE_OTP === "true" && env.ENVIRONMENT !== "production") {
    console.info(JSON.stringify({ level: "info", event: "auth_email_link", kind, to, url: link }));
  }

  const send = async () => {
    if (env.RESEND_API_KEY) {
      const copy = emailCopy(kind, link);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM || "Hisaab <onboarding@resend.dev>",
          to: [to],
          subject: copy.subject,
          html: copy.html,
          text: copy.text,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Resend returned ${response.status}: ${detail}`);
      }
      return;
    }
    if (!env.EMAIL_WEBHOOK_URL) {
      if (env.ENVIRONMENT !== "production") {
        console.info(
          JSON.stringify({
            level: "info",
            event: "auth_email_skipped",
            kind,
            reason: "provider_not_configured",
          }),
        );
        return;
      }
      throw new Error("Email provider is not configured");
    }
    const response = await fetch(env.EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${env.EMAIL_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify({ template: kind, to, url: link, product: "Hisaab" }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  };

  if (env.ENVIRONMENT === "production") {
    await send();
    return;
  }
  ctx.waitUntil(
    send().catch((cause) => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "auth_email_failed",
          kind,
          message: cause instanceof Error ? cause.message : "unknown",
        }),
      );
    }),
  );
}
