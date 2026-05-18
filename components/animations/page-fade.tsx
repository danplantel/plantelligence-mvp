"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageFadeProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function PageFade({ children, className, delay = 0 }: PageFadeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
      className={cn("will-change-transform", className)}
    >
      {children}
    </motion.div>
  );
}
