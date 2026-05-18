import { Metadata } from "next"
import PlanAnalytics from "@/components/pages/plan-analytics"

export const metadata: Metadata = {
  title: "Plan Analytics",
  description: "View and analyze your plan data.",
}

export default function PlanAnalyticsPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Plan Analytics</h2>
      </div>
      <PlanAnalytics planId={params.id} />
    </div>
  )
} 