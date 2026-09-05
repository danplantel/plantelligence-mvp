"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Plus } from "lucide-react";
import { Disclaimer } from "@/types/wizard";
import { AddDisclaimerModal } from "../add-disclaimer-modal/add-disclaimer-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface DisclaimersSummaryProps {
  disclaimers: Disclaimer[];
  onUpdateDisclaimer: (id: string, disclaimer: Omit<Disclaimer, "id">) => void;
  onDeleteDisclaimer: (id: string) => void;
  onAddAnother: () => void;
}

export function DisclaimersSummary({
  disclaimers,
  onUpdateDisclaimer,
  onDeleteDisclaimer,
  onAddAnother,
}: DisclaimersSummaryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Disclaimer awaiting delete confirmation
  const [disclaimerPendingDelete, setDisclaimerPendingDelete] =
    useState<Disclaimer | null>(null);

  const handleEdit = (disclaimer: Disclaimer) => {
    setEditingId(disclaimer.id);
    setIsModalOpen(true);
  };

  const handleModalSave = (disclaimer: Omit<Disclaimer, "id">) => {
    if (editingId) {
      onUpdateDisclaimer(editingId, disclaimer);
      setEditingId(null);
    }
    setIsModalOpen(false);
  };

  const handleModalClose = () => {
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleDeleteRequest = (disclaimer: Disclaimer) => {
    setDisclaimerPendingDelete(disclaimer);
  };

  const handleDeleteConfirmed = () => {
    if (disclaimerPendingDelete) {
      onDeleteDisclaimer(disclaimerPendingDelete.id);
    }
    setDisclaimerPendingDelete(null);
  };

  const getEditingDisclaimer = () => {
    return editingId ? disclaimers.find((d) => d.id === editingId) : null;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Added Disclaimers</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddAnother}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Another Disclaimer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {disclaimers.map((disclaimer) => (
              <div
                key={disclaimer.id}
                className="p-4 border rounded-lg bg-gray-50/50"
              >
                <div className="space-y-3">
                  {/* Locations */}
                  <div className="flex flex-wrap gap-2">
                    {disclaimer.locations.map((location, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs"
                      >
                        {location}
                      </Badge>
                    ))}
                    {disclaimer.customLocation && (
                      <Badge key="custom" variant="outline" className="text-xs">
                        {disclaimer.customLocation}
                      </Badge>
                    )}
                  </div>

                  {/* Disclaimer Text */}
                  <div className="text-sm text-gray-700 leading-relaxed">
                    {disclaimer.text}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(disclaimer)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRequest(disclaimer)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <AddDisclaimerModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        initialData={getEditingDisclaimer() || undefined}
      />

      {/* Delete disclaimer confirmation dialog */}
      <ConfirmDialog
        open={!!disclaimerPendingDelete}
        onOpenChange={(open) => {
          if (!open) setDisclaimerPendingDelete(null);
        }}
        onConfirm={handleDeleteConfirmed}
        title="Delete Disclaimer"
        description="Are you sure you want to delete this disclaimer?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}
