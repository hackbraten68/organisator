import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function Section({ children, className, title, description }: SectionProps) {
  return (
    <section className={cn("space-y-6", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h2 className="text-h2 font-semibold">{title}</h2>}
          {description && <p className="text-small text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
