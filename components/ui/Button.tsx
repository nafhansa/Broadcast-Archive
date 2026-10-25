import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "link" | "danger" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-green-700 text-white hover:bg-green-800 active:bg-green-800 disabled:opacity-50",
  secondary: "bg-surface border border-line-strong text-ink hover:bg-green-50 disabled:opacity-50",
  link: "bg-green-50 border border-green-100 text-green-800 hover:bg-green-100 w-full md:w-auto",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
  ghost: "text-ink-2 hover:bg-green-50 disabled:opacity-50",
};

export const buttonClass = (variant: Variant = "primary", extra?: string) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-md px-4 min-h-11 md:min-h-10 text-[15px] font-medium transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
    styles[variant],
    extra,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  function Button({ variant = "primary", className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClass(variant, className)} {...props} />;
  },
);
