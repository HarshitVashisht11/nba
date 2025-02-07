"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";


export function Steps({ steps, currentStep }
    
) {
  return (
    <div className="relative after:absolute after:left-0 after:top-[15px] after:h-0.5 after:w-full after:bg-muted">
      <div className="relative z-10 flex justify-between">
        {steps.map((step, index) => (
          <div key={step.title} className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background",
                index < currentStep
                  ? "border-primary"
                  : index === currentStep
                  ? "border-primary"
                  : "border-muted"
              )}
            >
              {index < currentStep ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <span
                  className={cn(
                    "text-sm",
                    index === currentStep ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
              )}
            </div>
            <div className="mt-2 hidden md:block">
              <p
                className={cn(
                  "text-center text-sm font-medium",
                  index <= currentStep ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.title}
              </p>
              <p className="text-center text-xs text-muted-foreground">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}