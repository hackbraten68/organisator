import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("container mx-auto max-w-[1600px] px-6 py-8", className)}>
      {children}
    </div>
  );
}
