"use client";

import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function SetupCompleteSection() {
  return (
    <Card className="shadow-none bg-green-50 border-green-200">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <CheckCircle className="size-8 text-green-600 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-semibold text-green-800">
              Setup Complete!
            </h3>
            <p className="text-sm text-green-700">
              Your client has been successfully set up and is ready to use.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
