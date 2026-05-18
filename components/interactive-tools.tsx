"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  Shield,
  Target,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

interface InteractiveToolsProps {
  brandColor?: string;
  secondaryColor?: string;
}

export function InteractiveTools({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
}: InteractiveToolsProps) {
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Stagger card animations
            setTimeout(() => setVisibleCards((prev) => [...prev, 0]), 100);
            setTimeout(() => setVisibleCards((prev) => [...prev, 1]), 200);
            setTimeout(() => setVisibleCards((prev) => [...prev, 2]), 300);
            setTimeout(() => setVisibleCards((prev) => [...prev, 3]), 400);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const tools = [
    {
      icon: Calculator,
      title: "Contribution Calculator",
      description:
        "Calculate how much you should contribute to maximize your retirement savings and employer match.",
      color: "bg-blue-50 text-blue-600",
      hoverColor: "group-hover:bg-blue-100",
    },
    {
      icon: Shield,
      title: "Insurance Comparison Tool",
      description:
        "Compare health, dental, and vision plans side-by-side to find the best coverage for your needs.",
      color: "bg-green-50 text-green-600",
      hoverColor: "group-hover:bg-green-100",
    },
    {
      icon: Target,
      title: "Future You Goal Builder",
      description:
        "Set financial goals and track your progress with our gamified retirement planning tool.",
      color: "bg-purple-50 text-purple-600",
      hoverColor: "group-hover:bg-purple-100",
    },
    {
      icon: HelpCircle,
      title: "Benefits Lifestyle Quiz",
      description:
        "Take our quiz to discover which benefits and coverage options best fit your lifestyle and family needs.",
      color: "bg-orange-50 text-orange-600",
      hoverColor: "group-hover:bg-orange-100",
    },
  ];

  return (
    <section ref={sectionRef} className="px-4 sm:px-6 lg:px-8 py-20 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="font-unna text-3xl lg:text-4xl font-normal mb-4"
            style={{ color: brandColor }}
          >
            Interactive Planning Tools
          </h2>
          <p className="text-lg text-[#6B6B6B] max-w-2xl mx-auto">
            Take control of your financial future with our easy-to-use
            calculators and planning resources.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tools.map((tool, index) => {
            const Icon = tool.icon;

            const isVisible = visibleCards.includes(index);

            return (
              <Card
                key={index}
                className={`group cursor-pointer transition-all duration-500 ease-out hover:shadow-xl hover:-translate-y-2 ${
                  isVisible
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-6 scale-95"
                }`}
              >
                <CardContent className="p-6 text-center h-full flex flex-col">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${tool.color} ${tool.hoverColor}`}
                  >
                    <Icon className="h-8 w-8" />
                  </div>
                  <h3
                    className="font-manrope text-lg font-bold mb-3"
                    style={{ color: brandColor }}
                  >
                    {tool.title}
                  </h3>
                  <p className="text-[#6B6B6B] text-sm mb-6 flex-grow leading-relaxed">
                    {tool.description}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full bg-white text-white transform transition-all duration-300 hover:scale-105 hover:shadow-md group-hover:-translate-y-1 active:scale-95"
                    style={{
                      backgroundColor: secondaryColor,
                      borderColor: secondaryColor,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    Try Tool
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
