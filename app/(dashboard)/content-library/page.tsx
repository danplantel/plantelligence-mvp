import { Metadata } from "next";
import ContentLibrary from "@/components/pages/content-library";

export const metadata: Metadata = {
  title: "Content Library",
  description: "Access and manage your content library.",
};

export default function ContentLibraryPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Content Library</h2>
      </div>
      <ContentLibrary />
    </div>
  );
}
