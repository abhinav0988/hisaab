import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { AppError, errorResponse, forbidden, notFound } from "./errors";
import { requestContext } from "./middleware";

describe("error responses", () => {
  const app = new Hono();
  app.use("*", requestContext);
  app.get("/forbidden", () => {
    throw forbidden();
  });
  app.get("/missing", () => {
    throw notFound("File");
  });
  app.get("/boom", () => {
    throw new Error("database password leaked");
  });
  app.onError((error, c) => errorResponse(c, error));

  it("returns a stable 403 body", async () => {
    const response = await app.request("http://localhost/forbidden");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." },
    });
  });

  it("uses not-found for a resource the caller does not own", async () => {
    const response = await app.request("http://localhost/missing");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });

  it("hides unexpected failures behind a stable 500", async () => {
    const response = await app.request("http://localhost/boom");
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { message: string; code: string } };
    expect(body.error).toEqual({ code: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    expect(JSON.stringify(body)).not.toContain("database password");
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("preserves an explicit service status", () => {
    const error = new AppError(503, "OCR_UNAVAILABLE", "Receipt scanning is not configured.");
    expect(error.status).toBe(503);
  });
});
