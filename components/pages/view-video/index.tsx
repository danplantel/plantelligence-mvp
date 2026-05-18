"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { ExternalLinkIcon } from "@radix-ui/react-icons"
import { useParams } from "next/navigation"
import { useEducationPlans } from "@/lib/education-video"
import { listEducationPlans } from "../content-library"
import { Icons } from "@/components/icons"
import { useTheme } from "next-themes"
import { videos } from "@/constants/data"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface VideoItem {
  videoUrl?: string
  title: string
  image: string
  data: Array<{
    icon?: React.ElementType
    title: string
    subTitle: string
    email?: string
    website?: string
    phone: string
    planId?: string
    image: string
  }>
}

interface CurrentVideo {
  id: string
  title: string
  videoUrl: string
  clientColor?: string
  logo: string
  resources: Array<{
    title: string
    url: string
    subTitle: string
    email?: string
    phone: string
    image: string
    icon: React.ElementType
  }>
}

interface EducationPlanItem {
  value: string
  label: string
  image: string
  icon?: string
  placeholderTitle?: string
  subLabel?: string
}

const ViewVideo = () => {
  const { theme } = useTheme()
  const params = useParams()
  const selectedEducationPlans = useEducationPlans()
  const id = params?.id
  const [currentVideo, setCurrentVideo] = useState<CurrentVideo | null>(null)
  const [activePlan, setActivePlan] = useState("")
  const [carouselIndex, setCarouselIndex] = useState(0)

  // Cast the filtered list to the correct type
  const listSelectedEducationPlans = listEducationPlans.filter((item) => 
    selectedEducationPlans.includes(item.value)
  ) as EducationPlanItem[]

  // Number of items to show in carousel at different breakpoints
  const getItemsToShow = () => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 640) return 1
      if (window.innerWidth < 1024) return 2
      return 3
    }
    return 3 // Default for SSR
  }

  const [itemsToShow, setItemsToShow] = useState(3)

  useEffect(() => {
    const handleResize = () => {
      setItemsToShow(getItemsToShow())
    }

    handleResize() // Set initial value
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const maxIndex = Math.max(0, listSelectedEducationPlans.length - itemsToShow)

  const nextSlide = () => {
    setCarouselIndex((prev) => Math.min(prev + 1, maxIndex))
  }

  const prevSlide = () => {
    setCarouselIndex((prev) => Math.max(prev - 1, 0))
  }

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const videoData = videos.find((video) => video.videoId === id)
        if (videoData) {
          setCurrentVideo({
            id: videoData.videoId,
            title: videoData.items.title,
            videoUrl: videoData.videoUrl || "/test.mp4",
            clientColor: videoData.clientColor,
            logo: videoData.items.image,
            resources: videoData.items.data
              .filter((item) => item.email || item.website || item.phone)
              .map((item) => ({
                title: item.title,
                url: item.website || "#",
                subTitle: item.subTitle,
                email: item.email,
                phone: item.phone,
                image: item.image,
                icon: item.icon || Icons.arrowRight, // Provide default icon
              })),
          })
        }
      } catch (error) {
        console.error("Error fetching video:", error)
      }
    }

    fetchVideo()
  }, [id])

  if (!currentVideo) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  // FAQ data
  const faqItems = [
    {
      question: "When should I start planning for retirement?",
      answer:
        "It's best to start planning for retirement as early as possible. The sooner you begin saving, the more time your money has to grow through compound interest. However, it's never too late to start planning for retirement.",
    },
    {
      question: "How much should I save for retirement?",
      answer:
        "Financial experts often recommend saving 10-15% of your income for retirement. However, the exact amount depends on your age, current savings, expected retirement age, and desired lifestyle in retirement. Consider using a retirement calculator or consulting with a financial advisor.",
    },
    {
      question: "What's the difference between a 401(k) and an IRA?",
      answer:
        "A 401(k) is an employer-sponsored retirement plan where contributions are often matched by employers. An IRA (Individual Retirement Account) is opened by an individual without employer involvement. Both offer tax advantages but have different contribution limits and withdrawal rules.",
    },
    {
      question: "When can I withdraw from my retirement accounts?",
      answer:
        "For most retirement accounts, you can begin taking penalty-free withdrawals at age 59½. Required Minimum Distributions (RMDs) generally begin at age 72. Early withdrawals before age 59½ typically incur a 10% penalty plus income tax, though there are some exceptions.",
    },
    {
      question: "Should I pay off debt before saving for retirement?",
      answer:
        "It depends on the type of debt. High-interest debt (like credit cards) should typically be paid off before focusing heavily on retirement savings. However, if your employer offers a 401(k) match, consider contributing enough to get the full match while paying down debt, as the match is essentially free money.",
    },
  ]

  return (
    <div className="container w-full px-4 mx-auto md:px-6">
      {/* SECTION 1: Main Video */}
      <div className="flex justify-center w-full mt-8">
        <div className="w-full max-w-4xl">
          <video className="w-full rounded-lg shadow-md" controls autoPlay muted>
            <source src={currentVideo.videoUrl} type="video/mp4" />
          </video>

          <div className="flex flex-col items-start justify-between gap-3 mt-4 mb-2 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <img
                src={currentVideo.logo || "/placeholder.svg?height=60&width=60"}
                alt="Logo"
                className="w-[60px] h-[60px] object-cover rounded-md"
              />
              <p className="font-bold text-2xl md:text-xl truncate max-w-[320px] md:max-w-none">
                {currentVideo.title || "Default Title"}
              </p>
            </div>
            <div>
              <Link href={"/"} target="_blank">
                <div className="text-sm underline cursor-pointer text-muted-foreground">
                  View in Spanish (En Español)
                </div>
              </Link>
            </div>
          </div>
          <Separator className="my-4" />
        </div>
      </div>

      {/* SECTION 2: Resources Section */}
      <div className="flex justify-center w-full mt-8">
        <div className="w-full max-w-6xl">
          <h2 className="mb-4 text-xl font-bold">Resources</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {(currentVideo.resources || []).map((item, index) => {
              const Icon = item.icon
              return (
                <div
                  key={index}
                  className="h-full overflow-hidden transition-shadow border rounded-md shadow-sm hover:shadow-md"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 p-2 text-white bg-black rounded-t-md">
                      <Icon className="w-4 h-4" />
                      <span className="text-base font-semibold">{item.title}</span>
                    </div>
                    <div className="flex flex-col flex-grow p-3">
                      <span className="text-base font-bold text-foreground">{item.subTitle}</span>
                      {item.email && (
                        <div className="flex items-center gap-2 mt-2">
                          <ExternalLinkIcon className="text-left" />
                          <span className="text-sm truncate text-muted-foreground">
                            <a href={`mailto:${item.email}`}>{item.email}</a>
                          </span>
                        </div>
                      )}
                      {item.url && item.url !== "#" && (
                        <div className="flex items-center gap-2 mt-2">
                          <ExternalLinkIcon className="text-left" />
                          <span className="text-sm truncate text-muted-foreground">
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              {item.url}
                            </a>
                          </span>
                        </div>
                      )}
                      {item.phone && (
                        <div className="flex items-center gap-2 mt-2">
                          <ExternalLinkIcon className="text-left" />
                          <span className="text-sm truncate text-muted-foreground">{item.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-center h-24 mt-auto">
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt={item.title}
                          className="w-full h-auto max-w-[80%] object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* SECTION 3: Educational Videos Carousel */}
      {listSelectedEducationPlans.length > 0 && (
        <div className="w-full mt-16 mb-16">
          <Separator className="mb-8" />
          <div className="w-full max-w-6xl mx-auto">
            <h2 className="mb-8 text-2xl font-bold text-center">Educational Videos</h2>

            <div className="relative">
              {carouselIndex > 0 && (
                <button
                  onClick={prevSlide}
                  className="absolute left-0 z-10 p-2 transition-colors -translate-y-1/2 rounded-full shadow-md top-1/2 bg-background/80 hover:bg-muted"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <div className="px-10 overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${carouselIndex * (100 / itemsToShow)}%)` }}
                >
                  {listSelectedEducationPlans.map((item, index) => {
                    // Use default icon if not specified
                    const iconName = item.icon || "arrowRight"
                    const Icon = (Icons as any)[iconName]
                    return (
                      <div 
                        className={`flex-shrink-0 px-2`} 
                        style={{ width: `${100 / itemsToShow}%` }} 
                        key={index}
                      >
                        <div
                          className="flex flex-col h-full transition-transform cursor-pointer hover:scale-105"
                          onClick={() => setActivePlan(item.label)}
                        >
                          <div className="relative flex w-full overflow-hidden border rounded-md shadow-sm aspect-video">
                            <div
                              className="text-xs leading-tight uppercase w-[54%] font-semibold text-center bg-black text-white flex items-center justify-center p-2"
                              style={{ backgroundColor: currentVideo?.clientColor }}
                            >
                              {item.placeholderTitle || item.label}
                            </div>
                            <div className="flex items-center justify-center flex-1 bg-white">
                              <Icon className="w-12 h-12" style={{ color: currentVideo?.clientColor }} />
                            </div>
                            {activePlan === item.label && (
                              <>
                                <div className="absolute w-full h-full rounded-md flex items-center justify-center backdrop-blur-[2px] bg-white/20" />
                                <Icons.play className="absolute text-white transform -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2" />
                              </>
                            )}
                          </div>
                          <div className="mt-3">
                            <p className="text-base font-bold leading-tight">
                              {item.label}
                            </p>
                            {item.subLabel && (
                              <p className="text-sm text-muted-foreground">{item.subLabel}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {carouselIndex < maxIndex && (
                <button
                  onClick={nextSlide}
                  className="absolute right-0 z-10 p-2 transition-colors -translate-y-1/2 rounded-full shadow-md top-1/2 bg-background/80 hover:bg-muted"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: FAQ Section */}
      <div className="w-full mt-16 mb-16">
        <Separator className="mb-8" />
        <div className="w-full max-w-3xl mx-auto">
          <h2 className="mb-8 text-2xl font-bold text-center">Frequently Asked Questions</h2>

          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="font-medium text-left">{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>

      {/* SECTION 5: Disclaimer Section */}
      <Separator className="mt-8" />
      <div className="w-full max-w-4xl mx-auto mt-6 mb-12 text-muted-foreground">
        <p className="text-xs">
          This material was created for educational and informational purposes only and is not intended as ERISA, tax,
          legal or investment advice. If you are seeking investment advice specific to your needs, such advice services
          must be obtained on your own separate from this educational material. Information has been obtained from
          sources believed to be reliable but is not guaranteed as to accuracy. Please refer to the Summary Plan
          Description for more information.
        </p>
        <p className="mt-2 text-xs">
          Securities and advisory services offered through LPL Financial, a registered investment advisor, Member
          <a href="https://www.finra.org" target="_blank" rel="noopener noreferrer" className="ml-1 text-primary">
            FINRA/SIPC
          </a>
          .
        </p>
      </div>
    </div>
  )
}

export default ViewVideo