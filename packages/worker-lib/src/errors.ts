import type { Context } from "hono";
import type { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}
export const notFound = (entity: string) =>
  new AppError(404, "NOT_FOUND", `${entity} was not found.`);
export const forbidden = () =>
  new AppError(403, "FORBIDDEN", "You do not have permission to perform this action.");

export function fromZod(error: ZodError): AppError {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return new AppError(
    400,
    "VALIDATION_ERROR",
    "Please correct the highlighted fields.",
    fieldErrors,
  );
}

export function errorResponse(c: Context, error: unknown) {
  const requestId = c.get("requestId") as string | undefined;
  if (error instanceof AppError) {
    return c.json(
      {
        success: false as const,
        error: {
          code: error.code,
          message: error.message,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        },
        requestId,
      },
      error.status,
    );
  }
  console.error(JSON.stringify({ level: "error", requestId, code: "UNEXPECTED_ERROR" }));
  return c.json(
    {
      success: false as const,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      requestId,
    },
    500,
  );
}
