import BreadCrumb from "@/components/breadcrumb";
import AdvisorMessages from "@/components/pages/advisor-messages";
import { ScrollArea } from "@/components/ui/scroll-area";

const breadcrumbItems = [
  { title: "Advisor Messages", link: "/advisor-message" },
];
export default function page() {
  return (
    <ScrollArea className="h-full">
      <div className="flex-1 p-4 pt-6 space-y-4 md:p-8">
        <BreadCrumb items={breadcrumbItems} />
        <AdvisorMessages />
      </div>
    </ScrollArea>
  );
}
