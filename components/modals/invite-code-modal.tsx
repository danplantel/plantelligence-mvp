"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icons } from "@/components/icons";

interface InviteCodeModalProps {
  open: boolean;
  handleClose: () => void;
}

const InviteCodeModal = ({ open, handleClose }: InviteCodeModalProps) => {
  const [code, setCode] = useState(["", "", "", "", ""]);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handleChange = (value: string, index: number) => {
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // If a value was entered and it's not the last input, move to next input
    if (value && index < code.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !code[index]) {
      // If current input is empty and backspace is pressed, move to previous input
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (code.join("") === "22222") {
      handleClose();
    } else {
      toast.error("Incorrect invite code");
      // Keep the modal open so the user can retry
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-[390px] mb-3 py-8 [&>button]:hidden shadow-none rounded-none border-0 bg-white dark:bg-[#030303] z-[60]">
        <div className="flex flex-col items-center mb-3 md:mb-0">
          <div className="h-[46px] w-[46px] rounded-[6px] mb-3 shadow-md overflow-hidden">
            <img
              src="/plan.png"
              alt="PlanTelligence"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-[24px] font-semibold text-black dark:text-white">
            Early Access
          </h2>
          <div className="mt-2 text-center">
            <p className="text-[#959595]">
              Enter invite code to access PlanTelligence.
            </p>
            <p className="text-[#959595]">
              Don&apos;t have a code?{" "}
              <a href="mailto:support@plantelligence.ai" className="underline">
                Get in touch
              </a>
              .
            </p>
          </div>
          <div className="flex mt-4 space-x-2">
            {code.map((char, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength={1}
                value={char}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-12 h-12 text-center bg-transparent text-black dark:text-white font-bold border border-[#efefef] dark:border-[#1c1c1c] rounded-md focus:outline-none focus:ring-2 focus:ring-[#005F73] text-[18px]"
              />
            ))}
          </div>
          <button
            onClick={handleSubmit}
            className="mt-6 inline-flex items-center justify-center rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            <span>Enter Code</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteCodeModal;
