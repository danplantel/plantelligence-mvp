import BreadCrumb from "@/components/breadcrumb";
import { PlanUpdateDashboard } from "@/components/pages/plan-update-dashboard";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function page({ params }: { params: { id: string } }) {
  const breadcrumbItems = [
    { title: "Update Plan", link: "/update-plan/" + params?.id },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="flex-1 p-4 pt-6 space-y-4 md:p-8">
        <BreadCrumb items={breadcrumbItems} />
        <PlanUpdateDashboard />
      </div>
    </ScrollArea>
  );
}
