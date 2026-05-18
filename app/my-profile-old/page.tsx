"use client"

import BreadCrumb from "@/components/breadcrumb";
import MyProfile from "@/components/pages/my-profile";
import { ScrollArea } from "@/components/ui/scroll-area";

const breadcrumbItems = [
  { title: "My Profile", link: "/my-profile" },
];
export default function page() {
  return (
    <ScrollArea className="h-full">
      <div className="flex-1 p-4 pt-6 space-y-4 md:p-8">
        <BreadCrumb items={breadcrumbItems} />
        <MyProfile />
      </div>
    </ScrollArea>
  );
}
