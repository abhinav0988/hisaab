type WaitUntilContext = { waitUntil(promise: Promise<unknown>): void };

export async function sendAuthEmail(
  env: Env,
  ctx: WaitUntilContext,
  kind: "verification" | "password-reset",
  to: string,
  url: string,
) {
  if (!env.EMAIL_WEBHOOK_URL) {
    if (env.ENVIRONMENT === "development")
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
  const promise = fetch(env.EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${env.EMAIL_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ template: kind, to, url, product: "Hisaab" }),
  }).then((response) => {
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  });
  ctx.waitUntil(promise);
}
