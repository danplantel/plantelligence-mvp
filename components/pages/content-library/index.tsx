"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import { useEducationPlans, useEducationPlansActions } from "@/lib/education-video"
import { useEffect, useState, useRef, useCallback } from "react"
import { useForm } from "react-hook-form"
import { motion } from "framer-motion"
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog"
import { X, Check, FileText, Globe, Calendar, PiggyBank } from "lucide-react"
import toast, { Toaster } from "react-hot-toast"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import axios from "axios"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const defaultValues = {
  rothOrTraditional: "",
  impact: "",
  howToSave: "",
  rolloverOptions: "",
  beneficiaryDesignations: "",
  targetDate: "",
  investmentDiversification: "",
  importance: "",
  makingBudget: "",
  basicInvestment: "",
  debtManagement: "",
  iras: "",
  retirementPlanLoans: "",
  socialSecurityBasics: "",
  retirementIncome: "",
  understandingFees: "",
  employerMatch: "",
  hardshipWithdrawals: "",
  requiredDistributions: "",
  catchUpContributions: "",
  retirementMilestones: "",
  taxStrategies: "",
  healthSavings: "",
  estatePlanning: "",
  top5Reasons: "",
  rolloversOrDistributions: "",
  socialSecurityBenefits: "",
  lifeInsurance: "",
  stockMarket: "",
  medicare101: "",
  priceIsWrong: "",
  chartingYourCourse: "",
}

export const listEducationPlans = [
  {
    value: "top5Reasons",
    label: "The Top 5 Reasons People Can't Retire",
    image: "/content-library/Top5ReasonsPeopleDontSave.png",
    video: "https://waypoint-bucket.s3.us-east-2.amazonaws.com/top-5-reasons.mp4",
  },
  {
    value: "rothOrTraditional",
    label: "Roth vs. Traditional",
    image: "/content-library/TheDecision.png",
  },
  {
    value: "rolloversOrDistributions",
    label: "Rollovers or Distributions",
    image: "/content-library/ShouldIStay.png",
  },
  {
    value: "socialSecurityBenefits",
    label: "Social Security Benefits",
    image: "/content-library/SocialSecurity.png",
  },
  {
    value: "lifeInsurance",
    label: "Life Insurance",
    image: "/content-library/3.jpg",
  },
  // {
  //   value: "stockMarket",
  //   label: "Stock Market Mayhem",
  //   image: "/content-library/stockmarketmayhem.png",
  // },
  {
    value: "chartingYourCourse",
    label: "Charting Your Course",
    image: "/content-library/2.jpg",
  },
  {
    value: "medicare101",
    label: "Medicare 101",
    image: "/content-library/1.jpg",
  },
  {
    value: "priceIsWrong",
    label: "The Price is Wrong",
    image: "/content-library/ThePriceisWrong.png",
  },
  // {
  //   value: "makingBudget",
  //   label: "Making a Budget",
  //   image: "/content-library/budget.jpg",
  // },
  // {
  //   value: "basicInvestment",
  //   label: "Investment Principles",
  //   image: "/content-library/investment.jpg",
  // },
  // {
  //   value: "debtManagement",
  //   label: "Debt Management",
  //   image: "/content-library/debt.jpg",
  // },
  // {
  //   value: "iras",
  //   label: "IRAs vs Plan Accounts",
  //   image: "/content-library/iras.jpg",
  // },
  // {
  //   value: "retirementPlanLoans",
  //   label: "Plan Loans",
  //   image: "/content-library/loans.jpg",
  // },
  // {
  //   value: "socialSecurityBasics",
  //   label: "Social Security",
  //   image: "/content-library/social-security.jpg",
  // },
  // {
  //   value: "retirementIncome",
  //   label: "Retirement Income",
  //   image: "/content-library/retirement-income.jpg",
  // },
  // {
  //   value: "understandingFees",
  //   label: "Understanding Fees",
  //   image: "/content-library/fees.jpg",
  // },
  // {
  //   value: "employerMatch",
  //   label: "Employer Match",
  //   image: "/content-library/employer-match.jpg",
  // },
  // {
  //   value: "hardshipWithdrawals",
  //   label: "Hardship Withdrawals",
  //   image: "/content-library/hardship.jpg",
  // },
  // {
  //   value: "requiredDistributions",
  //   label: "Required Distributions",
  //   image: "/content-library/distributions.jpg",
  // },
  // {
  //   value: "catchUpContributions",
  //   label: "Catch-Up Contributions",
  //   image: "/content-library/catch-up.jpg",
  // },
  // {
  //   value: "retirementMilestones",
  //   label: "Retirement Milestones",
  //   image: "/content-library/milestones.jpg",
  // },
  // {
  //   value: "taxStrategies",
  //   label: "Tax Strategies",
  //   image: "/content-library/tax.jpg",
  // },
  // {
  //   value: "healthSavings",
  //   label: "Health Savings Accounts",
  //   image: "/content-library/hsa.jpg",
  // },
  // {
  //   value: "estatePlanning",
  //   label: "Estate Planning",
  //   image: "/content-library/estate.jpg",
  // },
]

// Default fallback data in case API fails
const defaultPlanCollateral = [
  {
    clientId: "ayres",
    clientName: "Ayres",
    clientLogo: "/content-library/ayres-logo.png",
    items: [
      {
        title: "Portal Poster",
        english: { file: "/flyers/portal-en.pdf", image: "/content-library/portal-poster.jpg" },
        spanish: { file: "/flyers/portal-es.pdf", image: "/content-library/portal-poster.jpg" },
      },
      {
        title: "Meeting Announcement Poster",
        english: { file: "/flyers/meeting-announcement-en.pdf", image: "/content-library/meeting-announcement.jpg" },
        spanish: { file: "/flyers/meeting-announcement-es.pdf", image: "/content-library/meeting-announcement.jpg" },
      },
      {
        title: "Missing Retirement Poster",
        english: { file: "/flyers/missing-en.pdf", image: "/content-library/missing-retirement.jpg" },
        spanish: { file: "/flyers/missing-es.pdf", image: "/content-library/missing-retirement.jpg" },
      },
    ],
  },
]

const ContentLibrary = () => {
  const [isSelectAll, setIsSelectAll] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [previewItem, setPreviewItem] = useState<string | null>(null)
  const [videoItem, setVideoItem] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [planCollateral, setPlanCollateral] = useState(defaultPlanCollateral)
  const [isLoadingClients, setIsLoadingClients] = useState(true)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [selectedPlanIdIndex, setSelectedPlanIdIndex] = useState<string>("")
  const [plans, setPlans] = useState<any[]>([])
  // const [planSummaryVideo, setPlanSummaryVideo] = useState<any>(null)

  const selectedEducationPlans = useEducationPlans()
  const { updateEducationPlans } = useEducationPlansActions()
  const { data: session } = useSession()

  const form = useForm({
    defaultValues: defaultValues,
  })

  const selectedPlan = plans?.find(item => item?.idIndex === selectedPlanIdIndex) 

  const { handleSubmit, control, setValue, watch, getValues } = form

  const clientSectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const planCollateralSectionRef = useRef<HTMLDivElement | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Fetch client data based on user session
  useEffect(() => {
    const fetchClientData = async () => {
      setIsLoadingClients(true)
      try {
        // Replace with your actual API endpoint
        // const response = await axios.get("/api/plans/get-list-plan")
        const response = await axios.get("/api/plans/get-list-plan?videoStatus=completed")

        if (response.data?.data && response.data.data.length > 0) {
          // Transform the API response to match our planCollateral structure
          const clientData = response.data.data.map((client: any) => ({
            clientId: `client${client.idIndex}`,
            clientName: client.clientName,
            clientLogo: client.clientLogo || "/placeholder.svg",
            items: [
              {
                title: "Portal Poster",
                english: {
                  file: `client${client.idIndex}-portal-poster-en.pdf`,
                  image: "/content-library/portal-poster.jpg",
                },
                spanish: {
                  file: `client${client.idIndex}-portal-poster-es.pdf`,
                  image: "/content-library/portal-poster.jpg",
                },
              },
              {
                title: "Meeting Announcement Poster",
                english: {
                  file: `client${client.idIndex}-meeting-announcement-en.pdf`,
                  image: "/content-library/meeting-announcement.jpg",
                },
                spanish: {
                  file: `client${client.idIndex}-meeting-announcement-es.pdf`,
                  image: "/content-library/meeting-announcement.jpg",
                },
              },
              {
                title: "Missing Retirement Poster",
                english: {
                  file: `client${client.idIndex}-missing-retirement-en.pdf`,
                  image: "/content-library/missing-retirement.jpg",
                },
                spanish: {
                  file: `client${client.idIndex}-missing-retirement-es.pdf`,
                  image: "/content-library/missing-retirement.jpg",
                },
              },
            ],
          }))

          setPlanCollateral(clientData)
        }
      } catch (error) {
        console.error("Error fetching client data:", error)
        // Keep the default data if the API fails
      } finally {
        setIsLoadingClients(false)
      }
    }

    fetchClientData()
  }, [session])

  // Filter plan collateral based on selected plan
  const filteredPlanCollateral = planCollateral.filter(
    (client) => client.clientId === `client${selectedPlanIdIndex}`
  )

  useEffect(() => {
    const clientId = searchParams.get("client")
    const lang = searchParams.get("lang")

    // If we have client parameter, we're coming from the dashboard's Plan Collateral column
    if (clientId) {
      // First scroll to the Plan Collateral section
      setTimeout(() => {
        if (planCollateralSectionRef.current) {
          planCollateralSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" })

          // After scrolling to the section, find and scroll to the specific client
          setTimeout(() => {
            // Find the client in the planCollateral data
            // The dashboard might send numeric IDs or full client IDs
            const clientIdToFind = clientId.startsWith("client") ? clientId : `client${clientId}`

            const clientData = planCollateral.find((client) => client.clientId === clientIdToFind)

            if (clientData && clientSectionRefs.current[clientData.clientId]) {
              clientSectionRefs.current[clientData.clientId]?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              })

              // No highlighting applied
            }
          }, 500) // Delay to ensure the first scroll completes
        }
      }, 100)
    }
  }, [searchParams, planCollateral])

  const registerClientRef = useCallback((clientId: string, element: HTMLDivElement | null) => {
    if (element) {
      clientSectionRefs.current[clientId] = element
    }
  }, [])

  useEffect(() => {
    if (selectedEducationPlans.length > 0) {
      for (const key in defaultValues) {
        if (selectedEducationPlans.includes(key)) {
          setValue(key as any, key)
        } else {
          setValue(key as any, "")
        }
      }
    }
  }, [selectedEducationPlans, setValue])

  const values: any = getValues()

  useEffect(() => {
    for (const key in values) {
      if (!values[key]) {
        setIsSelectAll(false)
        return
      }
    }
    setIsSelectAll(true)
  }, [values, selectedEducationPlans])

  const selectAll = () => {
    if (!selectedPlanIdIndex) {
      toast.error("Please select a plan first")
      return
    }

    if (!isSelectAll) {
      for (const key in defaultValues) {
        setValue(key as any, key)
      }
    } else {
      for (const key in defaultValues) {
        setValue(key as any, "")
      }
    }
    setIsSelectAll((prev) => !prev)
  }

  const onSubmit = async (data: any) => {
    if (!selectedPlanIdIndex) {
      toast.error("Please select a plan first")
      return
    }

    const objValues = Object.values(data).filter((item) => !!item)
    
    try {
      await axios.post(`/api/plans/update-education-videos/${selectedPlanIdIndex}`, {
        videos: objValues
      })
      
      updateEducationPlans(objValues as string[])

      // Show success toast notification
      toast.success(
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">Selections saved</p>
            <p className="text-sm text-gray-500">{objValues.length} videos have been selected</p>
          </div>
        </div>,
        {
          duration: 3000,
          position: "top-center",
          style: {
            borderRadius: "10px",
            background: "#fff",
            color: "#333",
            boxShadow: "0 3px 10px rgba(0, 0, 0, 0.1)",
            padding: "16px",
          },
        },
      )
    } catch (error) {
      console.error("Error saving video selections:", error)
      toast.error("Failed to save video selections")
    }
  }

  // Fetch selected videos when plan changes
  useEffect(() => {
    const fetchSelectedVideos = async () => {
      if (!selectedPlanIdIndex) return
      try {
        const response = await axios.get(`/api/plans/get-education-videos/${selectedPlanIdIndex}`)
        if (response.data?.data) {
          // Reset form values
          for (const key in defaultValues) {
            setValue(key as any, "")
          }
          // Set selected values
          response.data.data.forEach((video: string) => {
            setValue(video as any, video)
          })
        }
      } catch (error) {
        console.error("Error fetching selected videos:", error)
      }
    }
    fetchSelectedVideos()
  }, [selectedPlanIdIndex, setValue])

  // Update isSelectAll when plan changes
  useEffect(() => {
    if (!selectedPlanIdIndex) {
      setIsSelectAll(false)
      return
    }
    const values = getValues()
    const allSelected = Object.values(values).every((value) => !!value)
    setIsSelectAll(allSelected)
  }, [selectedPlanIdIndex, getValues])

  const handleCardClick = (itemValue: string) => {
    if (!selectedPlanIdIndex) {
      toast.error("Please select a plan first")
      return
    }
    const currentValue = watch(itemValue as any)
    setValue(itemValue as any, currentValue ? "" : itemValue)
  }

  const downloadPDF = (file: string) => {
    // Check if the file path already starts with a slash
    const filePath = file.startsWith("/") ? file : `/content-library/${file}`
  
    const link = document.createElement("a")
    link.href = filePath
    link.download = file.split("/").pop() || file // Extract just the filename for download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  
    // Show download toast notification
    toast(
      <div className="flex items-center gap-2">
        <div>
          <p className="font-medium">Download started</p>
          <p className="text-sm text-gray-500">{file.split("/").pop() || file} is being downloaded.</p>
        </div>
      </div>,
      {
        duration: 2000,
        position: "top-center",
        style: {
          borderRadius: "10px",
          background: "#fff",
          color: "#333",
          boxShadow: "0 3px 10px rgba(0, 0, 0, 0.1)",
          padding: "16px",
        },
        icon: "📥",
      },
    )
  }

  const downloadAllPDFs = () => {
    setIsDownloading(true)

    toast(
      <div className="flex items-center gap-2">
        <div>
          <p className="font-medium">Downloading all posters</p>
          <p className="text-sm text-gray-500">Your files will begin downloading shortly.</p>
        </div>
      </div>,
      {
        duration: 3000,
        position: "top-center",
        style: {
          borderRadius: "10px",
          background: "#fff",
          color: "#333",
          boxShadow: "0 3px 10px rgba(0, 0, 0, 0.1)",
          padding: "16px",
        },
        icon: "📥",
      },
    )

    // Get the selected plan's items
    const selectedPlanIdIndexItems = filteredPlanCollateral[0]?.items || []
    const totalFiles = selectedPlanIdIndexItems.length

    let downloadedCount = 0

    // Download each file with a slight delay
    selectedPlanIdIndexItems.forEach((item, index) => {
      setTimeout(() => {
        downloadPDF(item.english.file)
        downloadedCount++

        // Check if all downloads are complete
        if (downloadedCount === totalFiles) {
          completeDownloads()
        }
      }, index * 300)
    })

    // Function to handle completion of all downloads
    const completeDownloads = () => {
      setTimeout(() => {
        setIsDownloading(false)

        // Show completion toast
        toast.success(
          <div className="flex items-center gap-2">
            <div>
              <p className="font-medium">All downloads complete</p>
              <p className="text-sm text-gray-500">{totalFiles} files have been downloaded.</p>
            </div>
          </div>,
          {
            duration: 3000,
            position: "top-center",
            style: {
              borderRadius: "10px",
              background: "#fff",
              color: "#333",
              boxShadow: "0 3px 10px rgba(0, 0, 0, 0.1)",
              padding: "16px",
            },
          },
        )
      }, 500)
    }
  }

  // Function to check if a URL is a direct video file (mp4, webm, etc.)
  const isDirectVideoFile = (url: string): boolean => {
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi"]
    return videoExtensions.some((ext) => url.toLowerCase().endsWith(ext))
  }

  const handlePreview = (e: React.MouseEvent, imageSrc: string, videoSrc?: string) => {
    e.stopPropagation()
    e.preventDefault()
    setPreviewItem(imageSrc)

    // Set the video source if provided
    if (videoSrc) {
      setVideoItem(videoSrc)
    } else {
      setVideoItem(null)
    }

    setIsPreviewOpen(true)
  }

  // Clear all hover states when dialog closes
  const handleDialogClose = (open: boolean) => {
    setIsPreviewOpen(open)
    if (!open) {
      // Reset video and hover states when dialog closes
      setVideoItem(null)
      setPreviewItem(null)
      setHoveredItem(null)

      // Force a small delay to ensure all hover states are cleared
      setTimeout(() => {
        const hoverElements = document.querySelectorAll(
          ".group-hover\\:blur-sm, .group-hover\\:opacity-100, .group-hover\\:bg-black\\/40",
        )
        hoverElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.opacity = ""
            el.style.filter = ""
            el.style.background = ""
          }
        })
      }, 50)
    }
  }

  // Fetch plans for the dropdown
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axios.get("/api/plans/get-list-plan?videoStatus=completed")
        if (response.data?.data) {
          setPlans(response.data.data)
          // Set the first plan as selected by default
          if (response.data.data.length > 0) {
            setSelectedPlanIdIndex(response.data.data[0].idIndex)
          }
        }
      } catch (error) {
        console.error("Error fetching plans:", error)
      }
    }
    fetchPlans()
  }, [])

  // Fetch plan summary video when plan changes
  // useEffect(() => {
  //   const fetchPlanSummaryVideo = async () => {
  //     if (!selectedPlanIdIndex) return
  //     try {
  //       const response = await axios.get(`/api/plans/get-plan-summary/${selectedPlanIdIndex}`)
  //       if (response.data?.data) {
  //         setPlanSummaryVideo(response.data.data)
  //       } else {
  //         setPlanSummaryVideo(null)
  //       }
  //     } catch (error) {
  //       console.error("Error fetching plan summary video:", error)
  //       setPlanSummaryVideo(null)
  //     }
  //   }
  //   fetchPlanSummaryVideo()
  // }, [selectedPlanIdIndex])

  return (
    <div className="space-y-4">
      {/* Toast container */}
      <Toaster position="top-center" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Select a plan</h2>
        </div>
        <Select value={selectedPlanIdIndex} onValueChange={setSelectedPlanIdIndex}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a plan">
              {selectedPlanIdIndex && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 overflow-hidden rounded-md">
                    <img
                      src={plans.find(p => p.idIndex === selectedPlanIdIndex)?.clientLogo || "/placeholder.svg"}
                      alt="Client logo"
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <span>{plans.find(p => p.idIndex === selectedPlanIdIndex)?.clientName}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[400px] overflow-y-auto">
            {plans.map((plan) => (
              <SelectItem key={plan.idIndex} value={plan.idIndex}>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 overflow-hidden rounded-md">
                    <img
                      src={plan.clientLogo || "/placeholder.svg"}
                      alt={plan.clientName}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <span>{plan.clientName}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plan Summary Video Section */}
      <div className="p-6 border rounded-lg">
        <h3 className="mb-4 text-lg font-medium">Plan Summary Video</h3>
        {selectedPlan?.video?.videoUrl ? (
          <div className="relative w-full pt-[56.25%] bg-black rounded-lg overflow-hidden">
            <video
              className="absolute top-0 left-0 w-full h-full"
              controls
              src={selectedPlan?.video?.videoUrl}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-muted">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-semibold">No summary video generated</h3>
            <p className="max-w-xs mb-4 text-sm text-muted-foreground">
              Generate a plan summary video in the benefits builder to see it here.
            </p>
            <Button variant="outline" onClick={() => router.push("/create-new-plan")}>
              Go to Benefits Builder
            </Button>
          </div>
        )}
      </div>

      {/* Educational Videos Section */}
      <div className="p-6 border rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Educational Videos</h3>
          <Button
            variant="ghost"
            onClick={selectAll}
            className="px-3 py-2 text-sm font-medium dark:bg-transparent border border-[#efefef] dark:border-[#1c1c1c] bg-gray-100 rounded-full"
          >
            {!isSelectAll ? "Select all" : "Unselect all"}
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="w-full">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {listEducationPlans.map((item) => (
                <FormField
                  control={control}
                  key={item.value}
                  name={item.value as any}
                  render={({ field }) => (
                    <FormItem>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCardClick(item.value)}
                        className={`relative rounded-lg border p-3 transition-all duration-200 ease-in-out cursor-pointer ${
                          watch(item.value as any) === item.value
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                            : "border-muted hover:border-gray-300"
                        } group`}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <div className="relative w-full overflow-hidden rounded-md aspect-video">
                            <img
                              src={item.image || "/placeholder.png"}
                              alt={item.label}
                              className="object-fill w-full h-full transition-all duration-200 ease-in-out group-hover:blur-sm"
                            />
                            <div className="absolute inset-0 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 group-hover:bg-black/40">
                              <Button
                                className="flex items-center gap-2 text-black bg-white rounded-full shadow-md hover:text-black"
                                onClick={(e) => handlePreview(e, item.image, item.video)}
                              >
                                Preview
                              </Button>
                            </div>
                          </div>
                          <h3 className="w-full text-sm font-medium text-center truncate">{item.label}</h3>
                        </div>
                      </motion.div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <div className="flex justify-center mt-6">
              <Button type="submit" size="lg">
                Save Selections
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Plan Collateral Section */}
      <div ref={planCollateralSectionRef} className="p-6 border rounded-lg">
        <h3 className="mb-4 text-lg font-medium">Plan Collateral</h3>
        {isLoadingClients ? (
          // Loading state for clients
          <div className="space-y-8">
            {[...Array(2)].map((_, index) => (
              <div key={index} className="space-y-4 animate-pulse">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-40 h-5 bg-gray-200 rounded dark:bg-gray-700"></div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {[...Array(3)].map((_, itemIndex) => (
                    <div key={itemIndex} className="h-64 bg-gray-100 rounded-lg dark:bg-gray-800"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredPlanCollateral.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-muted">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-semibold">No collateral found</h3>
            <p className="max-w-xs mb-4 text-sm text-muted-foreground">No collateral available for this plan.</p>
          </div>
        ) : (
          // Render client data
          filteredPlanCollateral.map((client, clientIndex) => (
            <div
              key={client.clientId}
              className="space-y-4"
              ref={(el) => registerClientRef(client.clientId, el)}
              id={`client-section-${client.clientId}`}
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {client.items.map((item, index) => (
                  <motion.div
                    key={`${client.clientId}-${index}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative overflow-hidden transition-all duration-200 ease-in-out border rounded-lg border-muted hover:border-gray-300 group"
                  >
                    <div className="flex flex-col">
                      <div className="relative w-full overflow-hidden aspect-[3/4]">
                        <img
                          src={`/content-library/${item.title === "Portal Poster" ? "DemoCo_Portal.jpg" : 
                            item.title === "Meeting Announcement Poster" ? "DemoCo_Meeting.jpg" : 
                            "DemoCo_MissingRet.jpg"}`}
                          alt={item.title}
                          className="object-cover w-full h-full transition-all duration-200 ease-in-out group-hover:blur-sm"
                        />
                        <div className="absolute inset-0 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 group-hover:bg-black/40">
                          <Button
                            className="flex items-center gap-2 text-black bg-white rounded-full shadow-md hover:text-black"
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadPDF(item.english.file)
                            }}
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm font-medium">{item.title}</h3>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}

        {!isLoadingClients && filteredPlanCollateral.length > 0 && (
          <div className="flex justify-center mt-8">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button size="lg" onClick={downloadAllPDFs} disabled={isDownloading} className="flex items-center gap-2">
                {isDownloading ? (
                  <>
                    <svg
                      className="w-4 h-4 text-white animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </>
                ) : (
                  <>Download All</>
                )}
              </Button>
            </motion.div>
          </div>
        )}
      </div>

      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open)
          if (!open) {
            // Reset video when dialog closes
            setTimeout(() => {
              setVideoItem(null)
              setPreviewItem(null)

              // Force reset all hover states
              document.querySelectorAll('.blur-sm, [class*="opacity-"], [class*="bg-black"]').forEach((el) => {
                if (el instanceof HTMLElement) {
                  el.classList.remove("blur-sm")
                  if (el.style.opacity) el.style.opacity = ""
                  if (el.style.filter) el.style.filter = ""
                  if (el.style.background) el.style.background = ""
                }
              })

              // Reset hovered item state
              setHoveredItem(null)
            }, 100)
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            {videoItem ? (
              <div className="relative w-full pt-[56.25%] bg-black">
                {isDirectVideoFile(videoItem) ? (
                  // For direct MP4 files, use the video element
                  <video
                    key={`video-${Date.now()}`}
                    className="absolute top-0 left-0 w-full h-full"
                    controls
                    autoPlay
                    playsInline
                    src={videoItem}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  // For YouTube or other embed URLs, use iframe
                  <iframe
                    key={`video-${Date.now()}`}
                    src={videoItem}
                    className="absolute top-0 left-0 w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Video Preview"
                  ></iframe>
                )}
              </div>
            ) : previewItem ? (
              <img
                src={previewItem || "/placeholder.png"}
                alt="Preview"
                className="w-full h-auto object-contain max-h-[80vh]"
              />
            ) : null}
            <DialogClose className="absolute z-10 p-2 text-black transition-colors bg-white rounded-full focus:outline-none top-2 right-2 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400">
              <X className="w-5 h-5" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ContentLibrary
