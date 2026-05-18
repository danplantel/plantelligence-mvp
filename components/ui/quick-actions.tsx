import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface Action {
  icon: LucideIcon;
  label: string;
  href: string;
  description: string;
}

interface QuickActionsProps {
  actions: Action[];
  title?: string;
}

export function QuickActions({
  actions,
  title = "Quick Actions",
}: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2.5">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="flex flex-col items-center gap-2 w-full h-[112px] p-0"
              asChild
            >
              <a href={action.href}>
                <action.icon className="size-6 text-accent-blue" />
                <div className="text-center">
                  <div className="font-medium text-sm font-regular">
                    {action.label}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {action.description}
                  </div>
                </div>
              </a>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
