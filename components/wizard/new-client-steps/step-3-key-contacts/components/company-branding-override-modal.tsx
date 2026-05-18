import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, Globe, FileText, ImageIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CompanyBrandingOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (syncGlobally: boolean) => void;
  pendingValue: string;
  type: "name" | "logo";
}

export function CompanyBrandingOverrideModal({
  isOpen,
  onClose,
  onConfirm,
  pendingValue,
  type,
}: CompanyBrandingOverrideModalProps) {
  const [syncType, setSyncType] = useState<"global" | "local">("global");

  const isName = type === "name";
  const title = isName ? "Update Company Name" : pendingValue ? "Update Company Logo" : "Remove Company Logo";
  
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-[550px]">
        <AlertDialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-accent-blue/10 flex items-center justify-center mb-4">
            {isName ? (
              <Building2 className="w-6 h-6 text-accent-blue" />
            ) : (
              <ImageIcon className="w-6 h-6 text-accent-blue" />
            )}
          </div>
          <AlertDialogTitle className="text-center text-xl">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center pt-2 text-base text-gray-600">
            {isName ? (
              <>
                You are changing the company name to <strong>&quot;{pendingValue}&quot;</strong>. How would you like to apply this change?
              </>
            ) : pendingValue ? (
              <>
                You are uploading a new company logo. How would you like to apply this change?
              </>
            ) : (
              <>
                You are removing the company logo. How would you like to apply this change?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-6">
          <RadioGroup
            value={syncType}
            onValueChange={(val) => setSyncType(val as "global" | "local")}
            className="space-y-4"
          >
            {/* Option A: Global Update */}
            <div
              className={cn(
                "relative flex items-start space-x-3 rounded-lg border-2 p-4 cursor-pointer transition-all",
                syncType === "global"
                  ? "border-accent-blue bg-accent-blue/5"
                  : "border-gray-200 hover:border-gray-300"
              )}
              onClick={() => setSyncType("global")}
            >
              <RadioGroupItem value="global" id="global" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="global" className="font-semibold text-base cursor-pointer flex items-center gap-2">
                  <Globe className="w-4 h-4 text-accent-blue" />
                  {isName ? "Update Plan Name Globally" : "Update Plan Logo Globally"}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {isName 
                    ? "This will update your company name in 'Company Basics' (Step 1) and affect all cards across the plan."
                    : "This will update your company logo in 'Company Basics' (Step 1) and affect all cards across the plan."}
                </p>
              </div>
            </div>

            {/* Option B: Local Override */}
            <div
              className={cn(
                "relative flex items-start space-x-3 rounded-lg border-2 p-4 cursor-pointer transition-all",
                syncType === "local"
                  ? "border-amber-500 bg-amber-50/30"
                  : "border-gray-200 hover:border-gray-300"
              )}
              onClick={() => setSyncType("local")}
            >
              <RadioGroupItem value="local" id="local" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="local" className="font-semibold text-base cursor-pointer flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Override for this card only
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {isName
                    ? "This card will use a custom name and will no longer sync with your global company name settings."
                    : "This card will use a custom logo and will no longer sync with your global company logo settings."}
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        <AlertDialogFooter className="items-center justify-center">
          <AlertDialogCancel onClick={onClose} className="sm:w-auto">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(syncType === "global")}
            className="bg-accent-blue hover:bg-accent-blue/90 sm:w-auto"
          >
            Apply Change
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
