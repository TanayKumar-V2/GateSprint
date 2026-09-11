export type AuthEventType = "sign-in" | "sign-out" | "sign-in-denied";

export type AuthEvent = {
  type: AuthEventType;
  ok: boolean;
  provider?: string;
  /** Internal user id only — never emails, tokens, or profile data. */
  userId?: string | null;
  reason?: string;
};

/**
 * Privacy-conscious auth logging. Timestamps + outcome + provider are
 * enough to spot brute-force or abuse patterns; anything identifying
 * stays out of the logs.
 */
export function logAuthEvent(event: AuthEvent): void {
  const record = {
    at: new Date().toISOString(),
    area: "auth",
    ...event,
    userId: event.userId ? "[present]" : null,
  };
  if (event.ok) {
    console.info(JSON.stringify(record));
  } else {
    console.warn(JSON.stringify(record));
  }
}
