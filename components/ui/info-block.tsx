"use client";

import { CheckCircle, Info, AlertCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

interface InfoBlockProps {
  variant?: "default" | "success" | "warning" | "destructive";
  title: string;
  description: string;
  className?: string;
}

const variants = {
  default: "bg-[#23919C]/10 border-accent-blue text-accent-blue",
  success: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  destructive: "bg-red-50 border-red-200 text-red-800",
};

const icons = {
  default: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  destructive: AlertCircle,
};

const iconColors = {
  default: "text-accent-blue",
  success: "text-green-600",
  warning: "text-yellow-600",
  destructive: "text-red-600",
};

export function InfoBlock({
  variant = "default",
  title,
  description,
  className,
}: InfoBlockProps) {
  const Icon = icons[variant];

  return (
    <Card className={cn("shadow-none", variants[variant], className)}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-3">
          <Icon
            className={cn("size-6 flex-shrink-0 mt-0.5", iconColors[variant])}
          />
          <div>
            <h4 className="text-base font-semibold mb-1">{title}</h4>
            <p className="text-sm text-black">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
