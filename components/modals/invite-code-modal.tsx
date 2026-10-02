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
          {/* The tile is square; the mark is not — `object-contain` so the whole bulb is drawn
              inside it. `object-cover` scaled the portrait artwork to FILL the square and cropped
              the overflow, which is why it looked cut off.

              The path was also relative with backslashes ("plantelligence-logos\pt_icon_light.png"):
              no leading slash means it resolves against the CURRENT route, so any nested page
              requested e.g. /settings/plantelligence-logos/... and got a 404. Every other surface
              in the app uses "/plantelligence-logos/pt_icon_*.png" — this now matches.

              Both variants are rendered and CSS picks one. That avoids pulling `useTheme` and a
              mounted flag into a modal that has neither, and it cannot flash the wrong artwork on
              first paint: the light-mode icon is dark artwork, which is near-invisible against
              this modal's dark background (`dark:bg-[#030303]` above). */}
          <div className="h-[46px] w-[46px] rounded-[6px] mb-3 overflow-hidden">
            <img
              src="/plantelligence-logos/pt_icon_light.png"
              alt="PlanTelligence"
              className="h-full w-full object-contain dark:hidden"
            />
            <img
              src="/plantelligence-logos/pt_icon_dark.png"
              alt="PlanTelligence"
              className="hidden h-full w-full object-contain dark:block"
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
                // Accent-blue at full strength, and the focus ring is the same token rather than
                // the hard-coded teal (#005F73) that used to sit beside a grey border — so the
                // empty boxes, the focused box and the button all read as one accent family.
                className="w-12 h-12 text-center bg-transparent text-black dark:text-white font-bold border border-accent-blue rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue text-[18px]"
              />
            ))}
          </div>
          <button
            onClick={handleSubmit}
            className="mt-6 inline-flex items-center justify-center rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-accent-blue text-white hover:bg-accent-blue/90 h-10 px-4 py-2"
          >
            <span>Enter Code</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteCodeModal;
