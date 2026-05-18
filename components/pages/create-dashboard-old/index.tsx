"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { toast } from "sonner"
import type { InfoTypes } from "@/types/InfoTypes"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AnimatePresence, motion } from "framer-motion"
import { ProgressVariants } from "@/components/ui/progress-variants"

import Branding from "./steps/Branding"
import PlanDetails from "./steps/PlanDetails"
import Eligibility from "./steps/Eligibility"
import MatchingVesting from "./steps/MatchingVesting"
import Resources from "./steps/Resources"

const steps = [
  { id: "branding", title: "Branding" },
  { id: "planDetails", title: "Plan Details" },
  { id: "eligibility", title: "Eligibility" },
  { id: "matching", title: "Matching & Vesting" },
  { id: "resources", title: "Resources" },
]

const PlaceholderStep = ({
  title,
  updateInfo,
  info,
  onComplete,
}: {
  title: string
  updateInfo: (info: Partial<InfoTypes>) => void
  info: Partial<InfoTypes>
  onComplete: () => void
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">This step is currently under development.</p>
          <Button
            onClick={() => {
              updateInfo({})
              onComplete()
            }}
            className="mt-4"
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

const CreateDashboard = () => {
  const [info, setInfo] = useState<Partial<InfoTypes>>({})
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const router = useRouter()
  const currentStep = steps[currentStepIndex]

  const handleUpdateInfo = async (newInfo: Partial<InfoTypes>) => {
    setInfo((prev) => ({ ...prev, ...newInfo }))

    // Mark current step as completed
    if (!completedSteps.includes(currentStep.id)) {
      setCompletedSteps([...completedSteps, currentStep.id])
    }
  }

  const handleSaveData = async (finalInfo: Partial<InfoTypes>) => {
    try {
      const payload = { ...info, ...finalInfo }

      if (payload?.clientLogo instanceof File) {
        try {
          const uploadRes = await axios.postForm(`/api/files/upload`, {
            file: payload?.clientLogo,
          })
          payload.clientLogo = uploadRes?.data?.url
        } catch (error) {
          console.error("Error uploading client logo:", error)
          // Continue with the process even if logo upload fails
        }
      }

      if (payload?.videoBackgroundImage instanceof File) {
        try {
          const uploadRes = await axios.postForm(`/api/files/upload`, {
            file: payload?.videoBackgroundImage,
          })
          payload.videoBackgroundImage = uploadRes?.data?.url
        } catch (error) {
          console.error("Error uploading background image:", error)
          // Continue with the process even if background image upload fails
        }
      }

      try {
        await axios.post(`/api/plans/create-plan`, payload)
        // Navigate to loading page instead of dashboard
        // router.push(`/loading-plan`)
        toast.success("Plan submitted successfully")
      } catch (error) {
        console.error("Error creating plan:", error)
        toast.error("Failed to create plan")
      }
    } catch (error) {
      console.error("handleSaveData.create", error)
      toast.error("Failed to create plan")
    }
  }

  const goToNextStep = () => {
    if (currentStepIndex <= steps.length) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStepIndex(currentStepIndex + 1)
        setIsAnimating(false)
      }, 300)
    }
  }

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStepIndex(currentStepIndex - 1)
        setIsAnimating(false)
      }, 300)
    }
  }

  const goToStep = (index: number) => {
    // Only allow navigation to completed steps or the current step
    if (index <= currentStepIndex || completedSteps.includes(steps[index].id)) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStepIndex(index)
        setIsAnimating(false)
      }, 300)
    }
  }

  // Update the renderStepContent function to use the combined components
  const renderStepContent = () => {
    switch (currentStep.id) {
      case "branding":
        return <Branding setActiveTab={goToNextStep} updateInfo={handleUpdateInfo} info={info} />

      case "planDetails":
        return <PlanDetails updateInfo={handleUpdateInfo} info={info} onComplete={goToNextStep} />

      case "eligibility":
        return <Eligibility updateInfo={handleUpdateInfo} info={info} onComplete={goToNextStep} />

      case "matching":
        return <MatchingVesting updateInfo={handleUpdateInfo} info={info} onComplete={goToNextStep} />

      case "resources":
        return <Resources updateInfo={handleUpdateInfo} info={info} onComplete={handleSaveData} />

      default:
        // For any step that doesn't have a component yet, show a placeholder
        return (
          <PlaceholderStep
            title={currentStep.title}
            updateInfo={handleUpdateInfo}
            info={info}
            onComplete={goToNextStep}
          />
        )
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Progress indicator - full width */}
      <div className="w-full mb-6">
        <ProgressVariants
          steps={steps}
          currentStepIndex={currentStepIndex}
          completedSteps={completedSteps}
          onStepClick={goToStep}
        />
      </div>

      {/* Content area with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="min-h-[400px]"
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>

      <p className="mt-12 text-center text-xs text-muted-foreground">
        It may take 5-10 minutes for the video to process.
      </p>
    </div>
  )
}

export default CreateDashboard
