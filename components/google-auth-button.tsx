"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "./ui/button";
import { Icons } from "./icons";
import { motion } from "framer-motion";

export default function GoogleSignInButton() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [isHovering, setIsHovering] = useState(false);
  const shineRef = useRef<HTMLDivElement>(null); // Specify the type here

  // Handle the shine effect manually
  useEffect(() => {
    if (isHovering && shineRef.current) {
      const shine = shineRef.current;
      shine.style.transition = "none";
      shine.style.left = "-100%";

      // Trigger reflow
      shine.offsetWidth;

      shine.style.transition = "left 0.8s ease";
      shine.style.left = "100%";
    }
  }, [isHovering]);

  return (
    <motion.div
      className="w-full"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{
        duration: 0.2,
        scale: {
          type: "spring",
          stiffness: 400,
          damping: 17,
        },
      }}
      onHoverStart={() => setIsHovering(true)}
      onHoverEnd={() => setIsHovering(false)}
    >
      <Button
        className="w-full relative bg-[#F2F2F4] dark:bg-[#0e0e0e] hover:bg-[#E8E8EA] dark:hover:bg-[#1a1a1a] py-8 border-[#efefef] dark:border-[#1c1c1c]"
        variant="outline"
        type="button"
        onClick={() =>
          signIn("google", { callbackUrl: callbackUrl ?? "/new/dashboard" })
        }
        style={{
          transition: "all 0.2s ease",
          boxShadow: isHovering
            ? "0 6px 20px rgba(0, 0, 0, 0.05)"
            : "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* Shine effect without keyframes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            ref={shineRef}
            className="absolute top-0 h-full w-[80px]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)",
              left: "-100%",
            }}
          />
        </div>

        <div className="relative z-10 flex items-center justify-center">
          <motion.div
            animate={isHovering ? { rotate: [0, -5, 5, 0] } : { rotate: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <Icons.google className="w-5 h-5" />
          </motion.div>
          <p className="ml-2 font-medium">Continue with Google</p>
        </div>
      </Button>
    </motion.div>
  );
}
