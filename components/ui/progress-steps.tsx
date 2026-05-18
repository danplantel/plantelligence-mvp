"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ProgressStepsProps {
  steps: { id: string; title: string }[]
  currentStepIndex: number
  completedSteps: string[]
  onStepClick: (index: number) => void
}

export function ProgressSteps({ steps, currentStepIndex, completedSteps, onStepClick }: ProgressStepsProps) {
  // Calculate progress percentage
  const progressPercentage = currentStepIndex === 0 ? 0 : (currentStepIndex / (steps.length - 1)) * 100

  return (
    <div className="mb-12">
      {/* Step title and progress */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-medium">{steps[currentStepIndex].title}</h1>
        <div className="text-sm text-muted-foreground">
          Step {currentStepIndex + 1} of {steps.length}
        </div>
      </div>

      {/* Minimal progress bar */}
      <div className="relative">
        <div className="h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>

        {/* Step indicators */}
        <div className="absolute top-0 left-0 w-full flex justify-between transform -translate-y-1/2">
          {steps.map((step, index) => {
            // Calculate if this step is active, completed, or upcoming
            const isCompleted = completedSteps.includes(step.id)
            const isActive = index === currentStepIndex
            const isAccessible = isCompleted || index <= currentStepIndex

            return (
              <button
                key={step.id}
                onClick={() => isAccessible && onStepClick(index)}
                className={`relative group ${isAccessible ? "cursor-pointer" : "cursor-not-allowed"}`}
                disabled={!isAccessible}
                aria-current={isActive ? "step" : undefined}
              >
                {/* Step indicator dot */}
                <motion.div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    isActive ? "bg-primary scale-150" : isCompleted ? "bg-primary" : "bg-gray-200"
                  }`}
                  initial={{ scale: isActive ? 1.5 : 1 }}
                  animate={{ scale: isActive ? 1.5 : 1 }}
                  transition={{ duration: 0.3 }}
                />

                {/* Step label - only visible on hover or active */}
                <div
                  className={cn(
                    "absolute top-6 left-1/2 transform -translate-x-1/2 transition-opacity duration-200 whitespace-nowrap text-xs font-medium",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  {step.title}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
