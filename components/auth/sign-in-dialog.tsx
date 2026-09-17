"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { signInWithGoogle } from "./sign-in-actions";
import { PasswordAuthForms } from "./password-forms";

type SignInDialogProps = {
  /** False when Google keys are missing — dialog shows setup copy instead. */
  configured: boolean;
  /** Styling for the trigger; the dialog renders the children as-is inside it. */
  triggerClassName?: string;
  children: ReactNode;
};

/**
 * AUTH modal unit — opens sign-in in place instead of navigating away.
 * Square CRT panel, focus-trapped, Escape/backdrop to abort. The /sign-in
 * route stays as the backstop for dashboard guards and OAuth errors.
 */
export function SignInDialog({ configured, triggerClassName, children }: SignInDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={triggerClassName}>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/70" />
        <Dialog.Popup
          aria-label="Sign in"
          className="fixed left-1/2 top-1/2 z-[80] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto border-2 border-(--crt-ink) bg-(--crt-bg) text-(--crt-ink) focus:outline-none"
        >
          <div aria-hidden="true" className="crt-scanlines pointer-events-none absolute inset-0" />
          {/* header strip */}
          <div className="crt-micro relative flex items-center justify-between border-b border-(--crt-line) px-5 py-2.5 text-[10px] text-(--crt-dim)">
            <span>[ AUTH {"///"} GATE-MENTOR ]</span>
            <Dialog.Close
              aria-label="Close sign-in"
              className="border border-(--crt-line) px-2 py-1 text-[11px] text-(--crt-ink) transition-colors hover:border-(--crt-red) hover:bg-(--crt-red) hover:text-(--crt-bg)"
            >
              X
            </Dialog.Close>
          </div>
          <div className="relative px-5 py-6 sm:px-7">
            <Dialog.Title className="crt-macro text-[clamp(1.8rem,6vw,2.6rem)]">
              INITIALIZE<span className="text-(--crt-red)">.</span>
              <br />
              SESSION
            </Dialog.Title>
            <Dialog.Description className="crt-micro mt-4 text-[11px] leading-relaxed text-(--crt-dim)">
              ONE ACCOUNT KEEPS YOUR ATTEMPTS, BOOKMARKS, AND MENTOR CHATS IN
              SYNC.
            </Dialog.Description>
            {configured ? (
              <form action={signInWithGoogle} className="mt-6">
                <button
                  type="submit"
                  className="crt-micro w-full bg-(--crt-red) px-6 py-4 text-center text-[13px] font-bold text-(--crt-bg) transition-colors hover:bg-(--crt-ink)"
                >
                  CONTINUE WITH GOOGLE &gt;&gt;&gt;
                </button>
              </form>
            ) : (
              <p role="alert" className="crt-micro mt-6 border border-(--crt-red) px-4 py-3 text-[11px] leading-relaxed text-(--crt-ink)">
                GOOGLE SIGN-IN ISN&apos;T SET UP YET — KEYS ARE MISSING ON THIS
                SERVER. EMAIL SIGN-IN BELOW STILL WORKS.
              </p>
            )}
            <div className="crt-micro mt-6 flex items-center gap-3 text-[10px] text-(--crt-dim)" aria-hidden="true">
              <span className="h-px flex-1 bg-(--crt-line)" />
              <span>[ OR {"///"} EMAIL ]</span>
              <span className="h-px flex-1 bg-(--crt-line)" />
            </div>
            <div className="mt-4">
              <PasswordAuthForms />
            </div>
            <p className="crt-micro mt-5 text-[10px] leading-relaxed text-(--crt-dim)">
              GOOGLE SHARES ONLY NAME / EMAIL / AVATAR.
              <br />
              STALLED HANDSHAKES ROUTE TO THE /SIGN-IN BACKUP TERMINAL.
            </p>
          </div>
          <div aria-hidden="true" className="crt-stripes relative h-2.5 w-full border-t border-(--crt-line)" />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
