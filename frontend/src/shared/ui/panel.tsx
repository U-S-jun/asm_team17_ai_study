import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
};

export function Panel({
  title,
  eyebrow,
  action,
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-neutral-200 bg-white shadow-sm shadow-neutral-200/50",
        className,
      )}
      {...props}
    >
      {(title || eyebrow || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-1 text-base font-semibold text-neutral-950">
                {title}
              </h2>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
