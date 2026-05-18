"use client";
import { X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  videoDescription?: string;
}

export function VideoModal({
  isOpen,
  onClose,
  videoTitle,
  videoDescription,
}: VideoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-manrope text-lg font-bold text-[#002B5B]">
              {videoTitle}
            </h3>
            {videoDescription && (
              <p className="text-sm text-[#6B6B6B] mt-1">{videoDescription}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="aspect-video bg-gray-900 flex items-center justify-center">
          <div className="text-center text-white">
            <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Video Player Placeholder</p>
            <p className="text-sm opacity-75 mt-2">
              In a real implementation, this would contain the video player
            </p>
          </div>
        </div>

        <div className="p-4 bg-white">
          <Button
            onClick={onClose}
            className="bg-[#26A69A] hover:bg-[#26A69A]/90 text-white"
          >
            Back to Education Hub
          </Button>
        </div>
      </div>
    </div>
  );
}
