import { Metadata } from "next";
import Documents from "@/components/pages/documents";

export const metadata: Metadata = {
  title: "Plan Materials",
  description: "Access and manage your plan materials.",
};

export default function DocumentsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Plan Materials</h2>
      </div>
      <Documents />
    </div>
  );
}
