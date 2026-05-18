"use client";

import { useState, useEffect, useRef } from "react";
import { Canvas, Image as FabricImage } from "fabric";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Image as ImageIcon, X, Save, Pencil } from "lucide-react";
import { Headshot } from "@/components/ui/headshot";

interface BrandingPreviewProps {
  logo: string;
  backgroundImage: string;
  brandColor: string;
  aiAvatar: string;
  missionStatement?: string;
  headshot?: string;
  headshotData?: any;
  username?: string;
  title?: string;
  orgName?: string;
  onEditHeadshot?: () => void;
  onEditBackground?: () => void;
  onHeadshotChange?: (newHeadshot: string) => void;
  onBackgroundChange?: (newBackground: string) => void;
  onWelcomeMessageChange?: (newText: string) => void;
  onOpenTextEditor?: (field: "headline" | "body") => void;
}

export function BrandingPreview({
  logo,
  backgroundImage,
  brandColor,
  aiAvatar,
  missionStatement = "",
  headshot,
  headshotData,
  username,
  title,
  orgName,
  onEditHeadshot,
  onEditBackground,
  onHeadshotChange,
  onBackgroundChange,
  onWelcomeMessageChange,
  onOpenTextEditor,
}: BrandingPreviewProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingElement, setEditingElement] = useState<string | null>(null); // 'avatar', 'text', null

  // Fabric.js refs for avatar
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  const avatarFabricRef = useRef<Canvas | null>(null);
  const [avatarDataURL, setAvatarDataURL] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [headlineValue, setHeadlineValue] = useState("");
  const [bodyValue, setBodyValue] = useState("");
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<
    "headline" | "body" | null
  >(null);
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);

  // Initialize Fabric.js canvas for avatar
  useEffect(() => {
    if (
      isEditMode &&
      editingElement === "avatar" &&
      avatarCanvasRef.current &&
      !avatarFabricRef.current &&
      headshot &&
      containerRef.current
    ) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      // Add padding to canvas (100% on each side) so image can extend well beyond save zone
      // This gives much more space for editing
      const padding = 1.0;
      const canvasWidth = containerWidth * (1 + padding * 2);
      const canvasHeight = containerHeight * (1 + padding * 2);

      // Safe zone is the original container size, centered in the larger canvas
      const safeZoneWidth = containerWidth;
      const safeZoneHeight = containerHeight;
      const safeZoneLeft = (canvasWidth - safeZoneWidth) / 2;
      const safeZoneTop = (canvasHeight - safeZoneHeight) / 2;

      const canvas = new Canvas(avatarCanvasRef.current, {
        width: canvasWidth,
        height: canvasHeight,
      });

      avatarFabricRef.current = canvas;

      const imageSource =
        headshotData?.square?.["400"] ||
        headshotData?.circle?.["400"] ||
        headshot;

      FabricImage.fromURL(imageSource).then((img: FabricImage) => {
        if (!img || !avatarFabricRef.current) return;

        // Calculate scale to match the preview mode (object-cover behavior)
        // This ensures the photo appears at the same size as in preview mode
        const scaleX = safeZoneWidth / (img.width || 1);
        const scaleY = safeZoneHeight / (img.height || 1);
        // Use Math.max to match object-cover behavior (fills container, maintains aspect ratio)
        const scale = Math.max(scaleX, scaleY);

        img.scale(scale);
        // Make corner size responsive to canvas size for better visibility
        const cornerSize = Math.max(
          12,
          Math.min(safeZoneWidth, safeZoneHeight) * 0.03,
        );
        img.set({
          left: safeZoneLeft + safeZoneWidth / 2,
          top: safeZoneTop + safeZoneHeight / 2,
          originX: "center",
          originY: "center",
          selectable: true,
          hasControls: true,
          hasBorders: true,
          borderColor: "#3b82f6",
          borderScaleFactor: 2, // Make borders more visible
          cornerColor: "#3b82f6",
          cornerStyle: "circle",
          transparentCorners: false,
          cornerSize: cornerSize,
          // Disable rotation for thumbnails
          lockRotation: true,
          // Enable uniform scaling only
          lockScalingFlip: true,
          uniformScaling: true,
        });

        // Hide rotation control and middle scaling controls
        // Only show corner controls for proportional scaling
        img.setControlsVisibility({
          mtr: false, // Hide rotation control (middle-top-rotation)
          ml: false, // Hide middle-left
          mr: false, // Hide middle-right
          mt: false, // Hide middle-top
          mb: false, // Hide middle-bottom
          // Keep only corner controls: tl, tr, bl, br (these work with uniformScaling)
        });

        avatarFabricRef.current.add(img);
        avatarFabricRef.current.setActiveObject(img);
        avatarFabricRef.current.renderAll();

        // Allow scaling without limits - remove any default restrictions
        img.on("scaling", () => {
          // Allow unlimited scaling in both directions
          const currentScale = img.scaleX || 1;
          // No restrictions - allow any scale
        });

        const updatePreview = () => {
          if (avatarFabricRef.current) {
            const dataURL = avatarFabricRef.current.toDataURL({
              format: "png",
              quality: 0.9,
              multiplier: 1,
            });
            setAvatarDataURL(dataURL);
          }
        };

        avatarFabricRef.current.on("object:modified", updatePreview);
        avatarFabricRef.current.on("object:scaling", updatePreview);
        avatarFabricRef.current.on("object:moving", updatePreview);
      });
    }

    return () => {
      if (avatarFabricRef.current && !isEditMode) {
        try {
          avatarFabricRef.current.off("object:modified");
          avatarFabricRef.current.off("object:scaling");
          avatarFabricRef.current.off("object:moving");
          avatarFabricRef.current.dispose();
          avatarFabricRef.current = null;
        } catch (error) {
          console.error("Canvas cleanup error (safe to ignore):", error);
        }
      }
    };
  }, [isEditMode, editingElement, headshot, headshotData]);

  // Handlers
  const handleEditAvatar = () => {
    setEditingElement("avatar");
    setIsEditMode(true);
  };

  const handleEditText = () => {
    const lines = missionStatement.split("\n\n");
    const headline = lines[0] || "";
    const body = lines.slice(1).join("\n\n");
    setEditingHeadline(true);
    setEditingBody(true);
    setHeadlineValue(headline);
    setBodyValue(body);
    setEditingElement("text");
    setIsEditMode(true);
  };

  useEffect(() => {
    const lines = missionStatement.split("\n\n");
    setHeadlineValue(lines[0] || "");
    setBodyValue(lines.slice(1).join("\n\n"));
  }, [missionStatement]);

  const handleSaveTextChanges = () => {
    const updated = [headlineValue, bodyValue].filter(Boolean).join("\n\n");
    onWelcomeMessageChange?.(updated);
    setEditingHeadline(false);
    setEditingBody(false);
  };

  const saveAvatarChanges = () => {
    if (avatarFabricRef.current && onHeadshotChange && containerRef.current) {
      try {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const padding = 1.0; // Match the padding used in canvas initialization
        const canvasWidth = containerWidth * (1 + padding * 2);
        const canvasHeight = containerHeight * (1 + padding * 2);
        const safeZoneLeft = (canvasWidth - containerWidth) / 2;
        const safeZoneTop = (canvasHeight - containerHeight) / 2;

        // Export only the safe zone area (the area that will be saved)
        const dataURL = avatarFabricRef.current.toDataURL({
          format: "png",
          quality: 0.9,
          multiplier: 1,
          left: safeZoneLeft,
          top: safeZoneTop,
          width: containerWidth,
          height: containerHeight,
        });

        setAvatarDataURL(dataURL);
        onHeadshotChange(dataURL);

        avatarFabricRef.current.off("object:modified");
        avatarFabricRef.current.off("object:scaling");
        avatarFabricRef.current.off("object:moving");
        avatarFabricRef.current.dispose();
        avatarFabricRef.current = null;
      } catch (error) {
        console.error("Error saving avatar:", error);
      }

      setEditingElement(null);
      setIsEditMode(false);
    }
  };

  const resetAvatar = () => {
    if (avatarFabricRef.current && containerRef.current) {
      const activeObject = avatarFabricRef.current.getActiveObject();
      if (activeObject) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const padding = 1.0; // Match the padding used in canvas initialization
        const canvasWidth = containerWidth * (1 + padding * 2);
        const canvasHeight = containerHeight * (1 + padding * 2);
        const safeZoneLeft = (canvasWidth - containerWidth) / 2;
        const safeZoneTop = (canvasHeight - containerHeight) / 2;

        const img = activeObject as FabricImage;
        // Calculate scale to match the preview mode (object-cover behavior)
        // This ensures the photo appears at the same size as in preview mode
        const scaleX = containerWidth / (img.width || 1);
        const scaleY = containerHeight / (img.height || 1);
        // Use Math.max to match object-cover behavior (fills container, maintains aspect ratio)
        const scale = Math.max(scaleX, scaleY);

        activeObject.set({
          left: safeZoneLeft + containerWidth / 2,
          top: safeZoneTop + containerHeight / 2,
          scaleX: scale,
          scaleY: scale,
        });
        avatarFabricRef.current.renderAll();
      }
    }
  };

  const handleCancelEdit = () => {
    if (editingElement === "avatar" && avatarFabricRef.current) {
      try {
        avatarFabricRef.current.off("object:modified");
        avatarFabricRef.current.off("object:scaling");
        avatarFabricRef.current.off("object:moving");
        avatarFabricRef.current.dispose();
        avatarFabricRef.current = null;
      } catch (cleanupError) {
        console.error("Canvas cleanup during cancel:", cleanupError);
      }
    }
    setEditingElement(null);
    setIsEditMode(false);
  };

  const hasAnyContent =
    missionStatement || headshot || username || title || orgName;
  if (!hasAnyContent) return null;

  return (
    <div className="relative w-full h-full flex-1 min-h-0 rounded-b-xl overflow-hidden bg-white">
      <div className="absolute inset-0 w-full h-full bg-white" />

      <div className="relative h-full flex flex-row">
        {/* Headshot */}
        <div className="w-full md:w-2/5 flex items-center justify-center relative p-0">
          {headshot && (
            <div
              ref={containerRef}
              data-preview-section="thumbnail"
              className={`relative w-[400px] h-[450px] max-w-full aspect-[400/450] group bg-white m-4 transition-all ${editingElement === "avatar" || isAvatarHovered
                  ? "overflow-visible z-30"
                  : "overflow-hidden"
                } ${isAvatarHovered && editingElement !== "avatar"
                  ? "ring-4 ring-blue-500/50"
                  : ""
                }`}
              onMouseEnter={() => !editingElement && setIsAvatarHovered(true)}
              onMouseLeave={() => setIsAvatarHovered(false)}
            >
              <div className="relative w-full h-full">
                {editingElement === "avatar" ? (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center overflow-visible">
                      <canvas
                        ref={avatarCanvasRef}
                        style={{
                          width: "300%",
                          height: "300%",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-dashed border-[#2563eb] z-40" />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
                      <Button
                        onClick={() => {
                          saveAvatarChanges();
                          setEditingElement(null);
                        }}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  </>
                ) : (
                  <div
                    className="relative w-full h-full cursor-pointer transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditHeadshot?.();
                    }}
                  >
                    <Headshot
                      src={
                        avatarDataURL ||
                        headshotData?.square?.["400"] ||
                        headshotData?.circle?.["400"] ||
                        headshot
                      }
                      alt="Headshot"
                      className="w-full h-full object-cover"
                    />
                    {isAvatarHovered && (
                      <div className="absolute -top-2 -left-2 z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                        <Pencil
                          className="w-3 h-3 text-white"
                          strokeWidth={2.5}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Text */}
        <div
          data-preview-section="mission"
          className="w-full md:w-3/5 px-6 md:px-16 py-6 md:py-8 flex flex-col justify-center"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={(e) => e.stopPropagation()}
          onMouseLeave={(e) => e.stopPropagation()}
        >
          {editingHeadline || editingBody ? (
            <div className="space-y-4">
              {(editingHeadline || !editingBody) && (
                <Textarea
                  value={headlineValue}
                  onChange={(e) => setHeadlineValue(e.target.value)}
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-serif font-bold h-48 md:h-64 w-full"
                  autoFocus={editingHeadline}
                  placeholder="Enter headline..."
                />
              )}
              {(editingBody || !editingHeadline) && (
                <Textarea
                  value={bodyValue}
                  onChange={(e) => setBodyValue(e.target.value)}
                  className="text-sm md:text-lg font-serif font-bold h-48 md:h-64 w-full"
                  placeholder="Enter body text..."
                />
              )}
              {editingElement === "text" && (
                <Button
                  onClick={() => {
                    handleSaveTextChanges();
                    setEditingElement(null);
                  }}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 w-fit"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <h1
                className={`text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-dm-serif font-bold mb-4 cursor-pointer relative px-2 py-1 rounded transition-all ${hoveredElement === "headline"
                    ? "ring-2 ring-blue-500/50"
                    : "hover:ring-2 hover:ring-blue-500/50"
                  }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenTextEditor) {
                    onOpenTextEditor("headline");
                  } else {
                    setEditingHeadline(true);
                    setEditingElement("text");
                  }
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredElement("headline");
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  if (hoveredElement === "headline") setHoveredElement(null);
                }}
              >
                {hoveredElement === "headline" && (
                  <span className="absolute -top-2 -left-2 z-20 bg-blue-500 rounded-full p-1.5 shadow-lg inline-block">
                    <Pencil className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </span>
                )}
                {headlineValue || missionStatement.split("\n\n")[0]}
              </h1>
              <p
                className={`text-base font-red-hat mb-5 leading-relaxed whitespace-pre-line cursor-pointer relative px-2 py-1 rounded transition-all ${hoveredElement === "body"
                    ? "ring-2 ring-blue-500/50"
                    : "hover:ring-2 hover:ring-blue-500/50"
                  }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenTextEditor) {
                    onOpenTextEditor("body");
                  } else {
                    setEditingBody(true);
                    setEditingElement("text");
                  }
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredElement("body");
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  if (hoveredElement === "body") setHoveredElement(null);
                }}
              >
                {hoveredElement === "body" && (
                  <span className="absolute -top-2 -left-2 z-20 bg-blue-500 rounded-full p-1.5 shadow-lg inline-block">
                    <Pencil className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </span>
                )}
                {bodyValue ||
                  missionStatement.split("\n\n").slice(1).join("\n\n")}
              </p>
              <button
                className="mt-4 px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-red-hat text-white uppercase rounded-md transition-colors duration-200 hover:opacity-90"
                style={{
                  background: brandColor || "#D4A574",
                }}
                aria-label="Explore your benefits"
              >
                EXPLORE YOUR BENEFITS
              </button>

              {editingElement === "text" && (
                <Button
                  onClick={() => {
                    handleSaveTextChanges();
                    setEditingElement(null);
                  }}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 w-fit mt-4"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
