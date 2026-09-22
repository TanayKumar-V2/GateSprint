import { NextResponse } from "next/server";
import { expireDueMocks } from "@/lib/mocks";

/**
 * Cron sweep: auto-finish papers past their end. Guarded by CRON_SECRET
 * (Bearer). Lazy expiry in get/answer/finish covers missed ticks, so this
 * is a backstop, not the mechanism.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Not found." } },
      { status: 404 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "You don't have access to this." } },
      { status: 403 },
    );
  }
  const result = await expireDueMocks();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
