"use client";

import { cn } from "@/lib/cn";

export function Switch({
  checked, onChange, label, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="grid min-h-11 min-w-11 cursor-pointer place-items-center disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={cn("relative h-5 w-9 rounded-full transition-colors duration-150", checked ? "bg-green-700" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all duration-150", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}
