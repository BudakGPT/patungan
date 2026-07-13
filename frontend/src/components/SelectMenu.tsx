"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SelectMenuOption<T extends string | number> {
  value: T;
  label: string;
}

interface SelectMenuProps<T extends string | number> {
  value: T;
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  align?: "left" | "right";
  className?: string;
}

export function SelectMenu<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  align = "right",
  className = "",
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const selected = options[selectedIndex];
  const optionKey = useMemo(
    () => options.map((option) => String(option.value)).join("|"),
    [options],
  );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    optionRefs.current[selectedIndex]?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, optionKey, selectedIndex]);

  function focusOption(index: number) {
    const next = (index + options.length) % options.length;
    optionRefs.current[next]?.focus();
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          setOpen(true);
        }}
        className={`group flex min-h-11 w-full items-center justify-between gap-4 rounded-full border px-4 text-left text-sm font-black transition-all duration-200 ${
          open
            ? "border-green bg-paper shadow-[0_0_0_3px_rgba(13,141,99,.13)]"
            : "border-ink/15 bg-paper shadow-[0_1px_0_rgba(7,18,15,.04)] hover:border-green/50 hover:bg-white"
        }`}
      >
        <span className="truncate text-ink">{selected?.label}</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute top-full z-50 mt-2 min-w-full overflow-hidden rounded-2xl border border-ink/10 bg-paper p-1.5 shadow-[0_18px_48px_rgba(7,18,15,.18)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusOption(index + 1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    focusOption(index - 1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    focusOption(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    focusOption(options.length - 1);
                  }
                }}
                className={`flex min-h-10 w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left text-sm font-bold transition-colors ${
                  active ? "bg-lime text-ink" : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <span className="whitespace-nowrap">{option.label}</span>
                <CheckIcon visible={active} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`size-4 shrink-0 text-ink/45 transition-transform duration-200 group-hover:text-green ${
        open ? "rotate-180" : ""
      }`}
    >
      <path d="m5 8 5 5 5-5" />
    </svg>
  );
}

function CheckIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`size-4 shrink-0 transition-opacity ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}
