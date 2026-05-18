import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { CustomAvatarFields, IPlanFormData } from "..";

interface CustomAvatarModalProps {
  showCustomAvatarModal: boolean;
  customAvatarFileInputRef: React.RefObject<HTMLInputElement>;
  customAvatarData: CustomAvatarFields;
  setCustomAvatarData: React.Dispatch<React.SetStateAction<CustomAvatarFields>>;
  setShowCustomAvatarModal: React.Dispatch<React.SetStateAction<boolean>>;
  setFormData: React.Dispatch<React.SetStateAction<IPlanFormData>>;
}

const CustomAvatarModal = (props: CustomAvatarModalProps) => {
  const {
    showCustomAvatarModal,
    customAvatarData,
    customAvatarFileInputRef,
    setShowCustomAvatarModal,
    setCustomAvatarData,
    setFormData,
  } = props;

  const { toast } = useToast();

  function handleCustomAvatarVideoUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (file) {
      setCustomAvatarData((prev) => ({ ...prev, video: file }));
    }
  }

  async function handleCustomAvatarSubmit() {
    if (!customAvatarData.name || !customAvatarData.video) {
      toast({
        variant: "destructive",
        description: "Please provide both name and video",
      });
      return;
    }

    try {
      // Upload the video first
      const formData = new FormData();
      formData.append("file", customAvatarData.video);
      const uploadRes = await axios.postForm(`/api/files/upload`, formData);

      // Update the form data with custom avatar info
      setFormData((prev: IPlanFormData) => ({
        ...prev,
        branding: {
          ...prev.branding,
          avatarChoice: "custom",
          avatarId: "custom",
          customAvatarName: customAvatarData.name,
          customAvatarVideo: uploadRes?.data?.url,
        },
      }));

      setShowCustomAvatarModal(false);
      setCustomAvatarData({ name: "", video: null });
    } catch (error) {
      console.error("Error uploading custom avatar video:", error);
      toast({
        variant: "destructive",
        description: "Failed to upload custom avatar video",
      });
    }
  }

  return (
    <Dialog
      open={showCustomAvatarModal}
      onOpenChange={setShowCustomAvatarModal}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Custom Avatar Setup</DialogTitle>
          <DialogDescription>
            Please provide your name and upload a 1-2 minute video of yourself
            talking.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Avatar Name</Label>
            <Input
              id="name"
              value={customAvatarData.name}
              onChange={(e) =>
                setCustomAvatarData((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              placeholder="Enter avatar name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="video">Video Upload</Label>
            <Input
              id="video"
              type="file"
              accept="video/*"
              ref={customAvatarFileInputRef}
              onChange={handleCustomAvatarVideoUpload}
              className="cursor-pointer"
            />
            <p className="text-sm text-muted-foreground">
              Upload a 1-2 minute video of yourself talking
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowCustomAvatarModal(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleCustomAvatarSubmit}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomAvatarModal;
