import { normalizeReceiptExtraction, type OcrReceiptResult } from "@hisaab/validation";
import { AppError, requireOwnedFile } from "@hisaab/worker-lib";

type VisionBinding = {
  run: (model: string, input: unknown) => Promise<unknown>;
};

function jsonFromModel(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const text = typeof record.response === "string" ? record.response : typeof record.description === "string" ? record.description : null;
  if (!text) return record.result ?? null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function scanReceipt(env: Env, userId: string, fileId: string): Promise<OcrReceiptResult> {
  const file = await requireOwnedFile(env.DB, userId, fileId);
  if (file.mimeType === "application/pdf") {
    throw new AppError(400, "OCR_UNSUPPORTED", "PDF scanning is not supported. Upload a JPEG or PNG.");
  }
  const ai = (env as { AI?: VisionBinding }).AI;
  if (!ai || !env.FILES) {
    throw new AppError(503, "OCR_UNAVAILABLE", "Receipt scanning is not configured.");
  }
  const object = await env.FILES.get(file.storageKey);
  if (!object) throw new AppError(400, "OCR_UNSUPPORTED", "The uploaded image could not be read.");
  const bytes = [...new Uint8Array(await object.arrayBuffer())];
  let payload: unknown;
  try {
    payload = await Promise.race([
      ai.run("@cf/meta/llama-3.2-11b-vision-instruct", {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract a receipt as JSON with nullable merchant, date (YYYY-MM-DD), totalMinor, currency, taxMinor, confidence, and items[{name,quantity,amountMinor}]. Use integer minor units. If a field is unreadable, use null. Do not guess.",
              },
              { type: "image", image: bytes },
            ],
          },
        ],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 20_000)),
    ]);
  } catch (error) {
    const timeout = error instanceof Error && error.message === "timeout";
    const message = error instanceof Error ? error.message : "unknown";
    console.error(
      JSON.stringify({
        level: "error",
        code: timeout ? "OCR_TIMEOUT" : "OCR_PROVIDER_FAILED",
        message,
      }),
    );
    if (message.startsWith("5016")) {
      throw new AppError(
        503,
        "OCR_UNAVAILABLE",
        "Receipt scanning is not enabled for this account yet. Enter the details manually.",
      );
    }
    throw new AppError(
      502,
      timeout ? "OCR_TIMEOUT" : "OCR_PROVIDER_FAILED",
      timeout ? "Receipt scanning timed out." : "Receipt scanning failed.",
    );
  }
  return normalizeReceiptExtraction(jsonFromModel(payload));
}
