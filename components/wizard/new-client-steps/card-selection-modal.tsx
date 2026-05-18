"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Circle } from "lucide-react";

// Compact Card Component
interface CompactCardProps {
  width?: string;
  backgroundColor?: string;
  className?: string;
  horizontal?: boolean;
}

const CompactCard = ({
  width = "w-full",
  backgroundColor = "bg-gray-50",
  className = "",
  horizontal = false,
}: CompactCardProps) => {
  if (horizontal) {
    return (
      <div
        className={`${backgroundColor} rounded-lg p-2 flex items-center gap-2 border border-gray-200 ${width} ${className}`}
      >
        <div className="w-6 h-6 rounded-full bg-gray-300 flex-shrink-0"></div>
        <div className="flex-1 justify-center flex gap-1">
          <div className="flex flex-col w-1/2 gap-1">
            <div className="w-1/3 h-2 bg-gray-300 rounded"></div>
            <div className="w-1/3 h-1.5 bg-gray-300 rounded"></div>
            <div className="w-1/2 bg-yellow-400 text-white text-[8px] font-semibold py-1 px-2 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${backgroundColor} rounded-lg p-1.5 flex flex-col items-center border border-gray-200 ${width} ${className}`}
    >
      <div className="w-6 h-6 rounded-full bg-gray-300 mb-1"></div>
      <div className="w-12 h-1 bg-gray-300 rounded mb-0.5"></div>
      <div className="w-10 h-0.5 bg-gray-300 rounded mb-1"></div>
      <div className="w-full bg-yellow-400 text-white text-[8px] font-semibold py-0.5 px-1 rounded"></div>
    </div>
  );
};

interface CardSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (selectedIndex: number | null) => void;
  initialSelectedIndex?: number | null;
}

export function CardSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIndex = null,
}: CardSelectionModalProps) {
  // Default to 0 if initialSelectedIndex is null (nothing saved)
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(
    initialSelectedIndex ?? 0,
  );

  const prevInitialIndexRef = useRef<number | null>(initialSelectedIndex);

  useEffect(() => {
    if (isOpen && prevInitialIndexRef.current !== initialSelectedIndex) {
      const newIndex = initialSelectedIndex ?? 0;
      setSelectedCardIndex(newIndex);
      prevInitialIndexRef.current = initialSelectedIndex;
    }
  }, [initialSelectedIndex, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Select Contact Display Style</DialogTitle>
          <DialogDescription>
            Please select the type of contact display layout you prefer.
          </DialogDescription>
        </DialogHeader>
        <div className="gap-4 px-6 pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <Card
                className={`w-1/2 p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-gray-300 relative ${selectedCardIndex === 0
                  ? "ring-2 ring-accent-blue border-accent-blue"
                  : ""
                  }`}
                onClick={() => setSelectedCardIndex(0)}
              >
                <div className="absolute top-2 right-2">
                  {selectedCardIndex === 0 ? (
                    <div className="bg-accent-blue rounded-full p-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <Circle className="w-6 h-6 text-gray-400 border-2 border-gray-400 rounded-full" />
                  )}
                </div>
                <div className="space-y-4">
                  <div className="w-full">
                    <CompactCard
                      horizontal={true}
                      width="w-full"
                      backgroundColor="bg-accent-blue"
                      className="text-white"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <CompactCard backgroundColor="bg-gray-50" />
                    <CompactCard backgroundColor="bg-gray-50" />
                    <CompactCard backgroundColor="bg-gray-50" />
                    <CompactCard backgroundColor="bg-gray-50" />
                  </div>
                </div>
              </Card>
              <Card
                className={`w-1/2 p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-gray-300 relative ${selectedCardIndex === 1
                  ? "ring-2 ring-accent-blue border-accent-blue"
                  : ""
                  }`}
                onClick={() => setSelectedCardIndex(1)}
              >
                <div className="absolute top-2 right-2">
                  {selectedCardIndex === 1 ? (
                    <div className="bg-accent-blue rounded-full p-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <Circle className="w-6 h-6 text-gray-400 border-2 border-gray-400 rounded-full" />
                  )}
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <CompactCard
                      horizontal={true}
                      width="w-full"
                      backgroundColor="bg-accent-blue"
                      className="text-white"
                    />
                    <CompactCard
                      horizontal={true}
                      width="w-full"
                      backgroundColor="bg-gray-50"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <CompactCard />
                    <CompactCard backgroundColor="bg-gray-50" />
                    <CompactCard backgroundColor="bg-gray-50" />
                  </div>
                </div>
              </Card>
            </div>
            <div className="flex gap-4">
              <Card
                className={`w-1/2 p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-gray-300 relative ${selectedCardIndex === 2
                  ? "ring-2 ring-accent-blue border-accent-blue"
                  : ""
                  }`}
                onClick={() => setSelectedCardIndex(2)}
              >
                <div className="absolute top-2 right-2">
                  {selectedCardIndex === 2 ? (
                    <div className="bg-accent-blue rounded-full p-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <Circle className="w-6 h-6 text-gray-400 border-2 border-gray-400 rounded-full" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <CompactCard
                    horizontal={true}
                    width="w-full"
                    backgroundColor="bg-accent-blue"
                    className="text-white"
                  />
                  <CompactCard
                    horizontal={true}
                    width="w-full"
                    backgroundColor="bg-gray-50"
                  />
                  <CompactCard
                    horizontal={true}
                    width="w-full"
                    backgroundColor="bg-gray-50"
                  />
                  <CompactCard
                    horizontal={true}
                    width="w-full"
                    backgroundColor="bg-gray-50"
                  />
                </div>
              </Card>

              <Card
                className={`w-1/2 p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-gray-300 relative ${selectedCardIndex === 3
                  ? "ring-2 ring-accent-blue border-accent-blue"
                  : ""
                  }`}
                onClick={() => setSelectedCardIndex(3)}
              >
                <div className="absolute top-2 right-2">
                  {selectedCardIndex === 3 ? (
                    <div className="bg-accent-blue rounded-full p-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <Circle className="w-6 h-6 text-gray-400 border-2 border-gray-400 rounded-full" />
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <CompactCard
                    width="w-full"
                    backgroundColor="bg-accent-blue"
                    className="text-white"
                  />
                  <CompactCard width="w-full" backgroundColor="bg-gray-50" />
                  <CompactCard width="w-full" backgroundColor="bg-gray-50" />
                  <CompactCard width="w-full" backgroundColor="bg-gray-50" />
                  <CompactCard width="w-full" backgroundColor="bg-gray-50" />
                  <CompactCard width="w-full" backgroundColor="bg-gray-50" />
                  <CompactCard width="w-full" backgroundColor="bg-gray-50" />
                  <CompactCard width="w-full" backgroundColor="bg-gray-50" />
                </div>
              </Card>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="min-w-[100px]">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (onConfirm) {
                onConfirm(selectedCardIndex);
              }
              onClose();
            }}
            className="min-w-[100px] bg-accent-blue hover:opacity-90 text-white transition-opacity"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
