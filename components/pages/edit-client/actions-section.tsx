"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";

interface ActionsSectionProps {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function ActionsSection({
  onSave,
  onCancel,
  saving,
}: ActionsSectionProps) {
  return (
    <Card className="shadow-none">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <Button onClick={onSave} disabled={saving} className="flex-1">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>

          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
