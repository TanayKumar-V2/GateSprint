import { NextResponse } from "next/server";

/**
 * Readiness endpoint for Docker HEALTHCHECK and platform probes.
 * Must never expose secrets, prompt internals, or user data.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "gate-mentor" },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
