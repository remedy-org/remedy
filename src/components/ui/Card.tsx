import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "aside" | "li";
  /** none for edge-to-edge content (tables, photos); md 24px; lg 32px (24px on phones). */
  padding?: "none" | "md" | "lg";
  /** surface-2 background, for a panel inside a card. */
  inset?: boolean;
}

/** Hairline-bordered surface, 10px radius, no shadow. */
export function Card({ as: Tag = "div", padding = "md", inset, className, ...rest }: CardProps) {
  return (
    <Tag
      className={clsx(
        "rounded-card border border-line",
        inset ? "bg-surface-2" : "bg-surface",
        padding === "md" && "p-6",
        padding === "lg" && "p-6 sm:p-8",
        className,
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** One muted line under the title. */
  description?: ReactNode;
  /** Right-aligned controls; wrap under the title on phones. */
  actions?: ReactNode;
  /** Heading level for the title (default h2). */
  level?: 2 | 3;
  className?: string;
}

export function CardHeader({ title, description, actions, level = 2, className }: CardHeaderProps) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={clsx("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <H className="text-body font-medium text-text">{title}</H>
        {description && <p className="mt-1 text-ui text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
