import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      {icon && <div className="mb-4 text-muted-foreground/50">{icon}</div>}
      <h3 className="text-h3 font-medium mb-1">{title}</h3>
      {description && <p className="text-small text-muted-foreground mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
