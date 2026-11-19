"use client";

import { usePathname, useSearchParams } from "next/navigation";

/** Hidden form field carrying the current path, so a form can return here. */
export function CurrentPathInput({ name = "next" }: { name?: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return <input type="hidden" name={name} value={search ? `${pathname}?${search}` : pathname} />;
}
