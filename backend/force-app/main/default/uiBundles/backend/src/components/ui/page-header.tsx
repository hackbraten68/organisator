import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps) {
  return (
    <header className={cn("space-y-4 pb-6 border-b", className)}>
      {children}
    </header>
  );
}
