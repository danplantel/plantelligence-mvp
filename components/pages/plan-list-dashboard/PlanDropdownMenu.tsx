"use client";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { videos } from "@/constants/data";
import type { IPlan } from "@/types/schema";
import { downloadFileFromUrl } from "@/lib/download-file";
import axios from "axios";
import Link from "next/link";
import { useState } from "react"; // Import useState hook
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { toast } from "sonner";
import { MoreVertical } from "lucide-react";

const menus = [
  {
    label: "Edit Plan",
    icon: "edit",
    screen: "edit-plan",
  },
  {
    label: "Embed Code",
    icon: "copy",
  },
  {
    label: "Download Video",
    icon: "download",
    action: "download-video",
  },
  // {
  //   label: "Send Plan Link",
  //   icon: "mail",
  // },
  // {
  //   label: "Generate QR Code",
  //   icon: "qr-code",
  // },
  // {
  //   label: "Download Participant Flyer",
  //   icon: "download",
  // },
  // {
  //   label: "Download Sponsor Flyer",
  //   icon: "download",
  // },
  {
    label: "Plan Analytics",
    icon: "chart",
    screen: "plan-analytics",
  },
  {
    label: "Plan Specs",
    icon: "view",
    screen: "plan-specs",
  },
  // {
  //   label: "Download Plan Video (Spanish)",
  //   icon: "download",
  // },
  // {
  //   label: "Password Protect",
  //   icon: "lock",
  // },
  // {
  //   label: "Delete Plan",
  //   icon: "delete",
  // },
];

type PlanVideoMeta = {
  videoUrl?: string | null;
  title?: string | null;
  videoStatus?: string | null;
};

interface IPlanDropdownMenuProps {
  plan: IPlan & { video?: PlanVideoMeta; isNewlyGenerated?: boolean };
  onDeleteSuccess?: VoidFunction;
}

export function PlanDropdownMenu(props: IPlanDropdownMenuProps) {
  const { plan, onDeleteSuccess } = props;
  const [openConfirmDeleteDialog, setOpenConfirmDeleteDialog] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);

  const handleDeletePlan = async () => {
    setIsLoadingDelete(true);
    try {
      await axios.delete(`/api/plans/delete-plan`, {
        params: {
          id: plan.id,
        },
      });
      toast.success("Delete plan successfully");
      setOpenConfirmDeleteDialog(false);
      onDeleteSuccess && onDeleteSuccess();
    } catch (error) {
      toast.error("Delete plan failed");
    }
    setIsLoadingDelete(false);
  };

  const handleDownloadVideo = async () => {
    const downloadUrl =
      plan?.video?.videoUrl ||
      (plan as any)?.videoUrl ||
      "";

    if (!downloadUrl) {
      toast.error("Video is not available for download yet");
      return;
    }

    try {
      setIsDownloadingVideo(true);
      await downloadFileFromUrl(
        downloadUrl,
        `${plan.clientName || "plan"}-video.mp4`,
      );
      toast.success("Download started");
    } catch (error) {
      console.error("Failed to download video:", error);
      toast.error("Failed to download video");
    } finally {
      setIsDownloadingVideo(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MoreVertical className="w-4 h-4 cursor-pointer" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" forceMount>
          <DropdownMenuGroup className="pr-1 w-fit">
            {menus.map((menu, index) => {
              const Icon = (Icons as any)[menu.icon || "arrowRight"];

              if (menu.screen === "edit-plan" && !plan?.isNewlyGenerated) {
                return null;
              }

              if (menu.screen) {
                return (
                  <Link
                    href={`/${menu.screen}/${
                      +(plan.idIndex || 0) + videos?.length
                    }`}
                    key={index}
                  >
                    <DropdownMenuItem>
                      <div className="flex items-center gap-[10px] cursor-pointer">
                        <Icon className="w-4 h-4" />{" "}
                        <span className="whitespace-nowrap text-[13px]">
                          {menu.label}
                        </span>
                      </div>
                      <DropdownMenuSeparator />
                    </DropdownMenuItem>
                  </Link>
                );
              }

              if (menu.action === "download-video") {
                return (
                  <DropdownMenuItem
                    key={index}
                    disabled={isDownloadingVideo}
                    onClick={(event) => {
                      event.preventDefault();
                      handleDownloadVideo();
                    }}
                  >
                    <div className="flex items-center gap-[10px] cursor-pointer">
                      {isDownloadingVideo ? (
                        <AiOutlineLoading3Quarters className="w-4 h-4 animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                      <span className="whitespace-nowrap text-[13px]">
                        {isDownloadingVideo ? "Preparing..." : menu.label}
                      </span>
                    </div>
                    <DropdownMenuSeparator />
                  </DropdownMenuItem>
                );
              }

              return (
                <DropdownMenuItem key={index}>
                  <div className="flex items-center gap-[10px] cursor-pointer">
                    <Icon className="w-4 h-4" />{" "}
                    <span className="whitespace-nowrap text-[13px]">
                      {menu.label}
                    </span>
                  </div>
                  <DropdownMenuSeparator />
                </DropdownMenuItem>
              );
            })}
            {plan?.isNewlyGenerated && (
              <DropdownMenuItem
                key="delete"
                onClick={() => setOpenConfirmDeleteDialog(true)}
              >
                <div className="flex items-center gap-[10px] cursor-pointer">
                  <Icons.delete className="w-4 h-4" />{" "}
                  <span className="whitespace-nowrap text-[13px]">
                    Delete Plan
                  </span>
                </div>
                <DropdownMenuSeparator />
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={openConfirmDeleteDialog}
        onOpenChange={setOpenConfirmDeleteDialog}
      >
        {/* <DialogTrigger asChild></DialogTrigger> */}
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-left">Confirm delete</DialogTitle>
            <DialogDescription className="text-left">
              Do you want to delete <b>{plan.clientName}</b> plan?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline">Cancel</Button>
            <Button disabled={isLoadingDelete} onClick={handleDeletePlan}>
              {isLoadingDelete && (
                <AiOutlineLoading3Quarters className="animate-spin mr-[8px]" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
