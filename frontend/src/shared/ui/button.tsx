import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "gradient";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" &&
          "bg-neutral-950 text-white hover:bg-neutral-800",
        variant === "secondary" &&
          "border border-neutral-300 bg-white text-neutral-950 hover:bg-neutral-100",
        variant === "ghost" && "text-neutral-600 hover:bg-neutral-100",
        variant === "gradient" &&
          "bg-gradient-to-r from-teal-500 to-slate-800 text-white shadow-sm hover:from-teal-600 hover:to-slate-900",
        className,
      )}
      {...props}
    />
  );
}
