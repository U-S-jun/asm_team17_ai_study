import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
};

export function Panel({
  title,
  eyebrow,
  description,
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
      {(title || eyebrow || description || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-1 text-base font-semibold text-neutral-950">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-neutral-500">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
