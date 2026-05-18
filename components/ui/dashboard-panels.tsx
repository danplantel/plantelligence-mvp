import { ResourcesPanel } from "./resources-panel";
import { MarketingPanel } from "./marketing-panel";
import { MeetingsPanel } from "./meetings-panel";
import { InsightsPanel } from "./insights-panel";

export function DashboardPanels() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ResourcesPanel />
      <MarketingPanel />
      <MeetingsPanel />
      <InsightsPanel />
    </div>
  );
}
