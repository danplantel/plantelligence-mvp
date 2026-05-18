import BreadCrumb from "@/components/breadcrumb";
import ContentLibrary from "@/components/pages/content-library";
import { ScrollArea } from "@/components/ui/scroll-area";

const breadcrumbItems = [{ title: "Content Library", link: "/content-library" }];
export default function page() {
    return (
        <ScrollArea className="h-full">
            <div className="flex-1 p-4 pt-6 space-y-4 md:p-8">
                <BreadCrumb items={breadcrumbItems} />
                <ContentLibrary />
            </div>
        </ScrollArea>
    );
}
