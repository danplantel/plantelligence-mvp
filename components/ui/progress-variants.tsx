"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressVariantsProps {
  steps: { id: string; title: string }[];
  currentStepIndex: number;
  completedSteps: string[];
  onStepClick: (index: number) => void;
}

export function ProgressVariants({
  steps,
  currentStepIndex,
  completedSteps,
  onStepClick,
}: ProgressVariantsProps) {
  // Calculate progress percentage
  const progressPercentage = (currentStepIndex / (steps.length - 1)) * 100;

  return (
    <div className="mb-6 w-full">
      {/* Modern tab-style with visual hierarchy */}
      <div className="flex flex-col space-y-6 w-full">
        <div className="flex items-center justify-between px-1 w-full">
          <div className="text-sm font-medium text-primary">
            Step {currentStepIndex + 1} of {steps.length}
          </div>
          <div className="text-sm font-medium text-primary">
            {Math.round(progressPercentage)}/100%
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1 w-full">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isActive = index === currentStepIndex;
            const isAccessible = isCompleted || index <= currentStepIndex;

            return (
              <button
                key={step.id}
                onClick={() => isAccessible && onStepClick(index)}
                disabled={!isAccessible}
                className={cn(
                  "group relative flex flex-col w-full items-center",
                  isAccessible ? "cursor-pointer" : "cursor-not-allowed",
                )}
              >
                {/* Progress bar */}
                <div
                  className={cn(
                    "h-2 w-full rounded-full transition-colors duration-300",
                    isActive
                      ? "bg-primary"
                      : isCompleted
                      ? "bg-primary"
                      : "bg-gray-200",
                  )}
                />

                {/* Step indicator */}
                <motion.div
                  className={cn(
                    "mt-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all duration-300",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
                      : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-gray-100 text-gray-400",
                  )}
                  initial={{ scale: 1 }}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    transition: { duration: 0.3 },
                  }}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </motion.div>

                {/* Step label - always visible with truncation */}
                <div
                  className={cn(
                    "mt-2 text-xs font-medium transition-all duration-200 text-center w-full px-1",
                    isActive
                      ? "text-primary font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="block truncate" title={step.title}>
                    {step.title}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
