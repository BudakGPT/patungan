"use client";

import { categoryMeta } from "@/lib/category";
import { useStrings } from "@/lib/locale";

/**
 * A campaign's category as a muted tinted pill (reused on cards, detail, dashboard, operator).
 * `size="sm"` is the on-card default; `md` for standalone contexts.
 */
export function CategoryChip({
  tag,
  size = "sm",
}: {
  tag: string;
  size?: "sm" | "md";
}) {
  const { categories } = useStrings();
  const { label, chip } = categoryMeta(tag, categories);
  const pad = size === "sm" ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium tracking-wide ${pad} ${chip}`}
    >
      {label}
    </span>
  );
}
