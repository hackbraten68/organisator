import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface FormFieldProps {
  children: ReactNode;
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
}

export function FormField({ children, label, required, error, hint, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-small font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-caption text-destructive">{error}</p>}
      {hint && !error && <p className="text-caption text-muted-foreground">{hint}</p>}
    </div>
  );
}
