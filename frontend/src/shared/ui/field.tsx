import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type FieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, hint, children, className, ...props }: FieldProps) {
  return (
    <label className={cn("block", className)} {...props}>
      <span className="text-sm font-semibold text-neutral-900">{label}</span>
      {hint && <span className="ml-2 text-xs text-neutral-500">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
