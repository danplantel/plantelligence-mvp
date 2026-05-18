"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import loadingAnimation from "@/public/loading.json"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import dynamic from "next/dynamic";

const Lottie = dynamic(() => import("lottie-react"), {
  ssr: false,
});

export default function LoadingPlanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [elapsedTime, setElapsedTime] = useState(0)
  const isCustomAvatar = searchParams.get('customAvatar') === 'true'

  // Optional: Add a timer to show elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <div className="w-64 h-64 mb-4">
            <Lottie animationData={loadingAnimation} loop={true} />
          </div>

          <h1 className="text-2xl font-bold mb-2">Plan Generating..</h1>

          <p className="text-muted-foreground mb-6">
            {isCustomAvatar 
              ? "Your plan with custom avatar is being processed. This may take 1 business day to complete. You'll find it in the Content Library and on your dashboard once it's ready."
              : "Your plan is being processed. This may take 5-10 minutes to complete. You'll find it in the Content Library and on your dashboard once it's ready."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Button variant="outline" className="rounded-full" onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </Button>

            <Button className="rounded-full" onClick={() => router.push("/content-library")}>
              Go to Content Library
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
