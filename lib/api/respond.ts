import { NextResponse } from "next/server";

type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** 400 — input failed validation. Include what was wrong, not internals. */
export function badRequest(message = "Invalid request.") {
  return error("bad_request", message, 400);
}

/** 401 — no signed-in user. */
export function unauthorized(message = "Sign in to continue.") {
  return error("unauthorized", message, 401);
}

/**
 * 403 — signed in, but not the owner. Kept generic on purpose.
 */
export function forbidden(message = "You don't have access to this.") {
  return error("forbidden", message, 403);
}

/**
 * 404 — missing, or owned by someone else. Same response either way so
 * existence can't be probed across accounts.
 */
export function notFoundPrivate(message = "Not found.") {
  return error("not_found", message, 404);
}
