"use client";

import { useActionState, useState } from "react";
import {
  signInWithPassword,
  signUpWithPassword,
} from "./sign-in-actions";

/**
 * Email+password auth in CRT dress: sign-in / create-account toggle,
 * square fields, red submit block, generic failure copy (no enumeration).
 * Shared by the auth modal and the /sign-in backstop page.
 */
export function PasswordAuthForms() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction, inPending] = useActionState(signInWithPassword, {});
  const [upState, upAction, upPending] = useActionState(signUpWithPassword, {});
  const state = mode === "in" ? inState : upState;
  const pending = inPending || upPending;

  return (
    <div>
      <div className="crt-micro grid grid-cols-2 gap-px border border-(--crt-line) bg-(--crt-line) text-[11px]" role="group" aria-label="Email auth mode">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`px-4 py-2.5 transition-colors ${
              mode === m
                ? "bg-(--crt-ink) font-bold text-(--crt-bg)"
                : "bg-(--crt-bg) text-(--crt-dim) hover:text-(--crt-ink)"
            }`}
          >
            {m === "in" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        ))}
      </div>

      <form action={mode === "in" ? inAction : upAction} className="mt-4 flex flex-col gap-3">
        {mode === "up" ? (
          <label className="flex flex-col gap-1.5">
            <span className="crt-label">Name (optional)</span>
            <input
              name="name"
              type="text"
              autoComplete="name"
              maxLength={60}
              placeholder="OPERATOR NAME"
              className="crt-field"
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1.5">
          <span className="crt-label">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            placeholder="YOU@EXAMPLE.COM"
            className="crt-field"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="crt-label">
            Password{mode === "up" ? " (8+ characters)" : ""}
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={mode === "up" ? 8 : 1}
            maxLength={128}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            placeholder="••••••••"
            className="crt-field"
          />
        </label>
        {state.error ? (
          <p role="alert" className="crt-micro border border-(--crt-red) px-3 py-2 text-[11px] leading-relaxed text-(--crt-ink)">
            !! {state.error.toUpperCase()}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="crt-btn-red w-full">
          {pending
            ? "VERIFYING…"
            : mode === "in"
              ? "SIGN IN >>>"
              : "CREATE ACCOUNT >>>"}
        </button>
      </form>
    </div>
  );
}
