"use client";

import Image from "next/image";
import { LogOut, UserRound } from "lucide-react";
import { Menu } from "@base-ui/react/menu";

/**
 * Account menu behind the far-right operator block: Profile opens
 * /u/[username], Sign out ends the session. Square CRT popup, red
 * hover flood, anchored bottom-end.
 */
export function UserMenu({
  username,
  name,
  image,
  onSignOut,
}: {
  username: string;
  name: string | null;
  image: string | null;
  onSignOut: () => Promise<void>;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Account menu"
        className="crt-micro grid size-9 shrink-0 place-items-center overflow-hidden border border-(--crt-edge) bg-(--crt-bg) text-[11px] font-bold text-(--crt-ink) outline-none transition-colors hover:border-(--crt-red) hover:bg-(--crt-red) hover:text-(--crt-bg) focus-visible:border-(--crt-red) data-[popup-open]:border-(--crt-red) data-[popup-open]:bg-(--crt-red) data-[popup-open]:text-(--crt-bg)"
      >
        {image ? (
          <Image
            src={image}
            alt=""
            width={36}
            height={36}
            className="size-9 object-cover"
          />
        ) : (
          <UserRound className="size-4" />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8}>
          <Menu.Popup className="crt-micro min-w-56 origin-top-right border-2 border-(--crt-ink) bg-(--crt-bg) p-1.5 text-[11px] text-(--crt-ink) outline-none">
            <p className="truncate px-3 pb-1.5 pt-2 text-[10px] text-(--crt-dim)">
              OPERATOR: {name ?? `@${username}`}
            </p>
            <Menu.LinkItem
              href={`/u/${username}`}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 font-bold outline-none transition-colors hover:bg-(--crt-red) hover:text-(--crt-bg) focus-visible:bg-(--crt-red) focus-visible:text-(--crt-bg)"
            >
              <UserRound className="size-4" />
              PROFILE
            </Menu.LinkItem>
            <Menu.Item
              onClick={() => void onSignOut()}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 font-bold outline-none transition-colors hover:bg-(--crt-red) hover:text-(--crt-bg) focus-visible:bg-(--crt-red) focus-visible:text-(--crt-bg)"
            >
              <LogOut className="size-4" />
              SIGN OUT
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
