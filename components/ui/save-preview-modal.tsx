"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PortalTeam } from "@/components/pages/client-portal/sections/portal-team";
import { KeyContact } from "@/types/new-client-wizard";

interface SavePreviewModalProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  contacts: KeyContact[];
  companyLogo?: string;
  onAddContact?: (contact: KeyContact) => void;
}

export function SavePreviewModal({
  open,
  onOpenChange,
  contacts,
  companyLogo,
  onAddContact,
}: SavePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Contact Preview</DialogTitle>
        </DialogHeader>

        <ScrollArea className="px-4 py-3 h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts && contacts.length > 0 ? (
              contacts.map((contact) => (
                <div
                  onClick={() => {
                    onAddContact?.(contact);
                    onOpenChange(false);
                  }}
                  key={contact.id}
                  className="w-full"
                >
                  <PortalTeam keyContacts={[contact]} hideTitle={true} />
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 mt-10">
                No saved contacts yet
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
