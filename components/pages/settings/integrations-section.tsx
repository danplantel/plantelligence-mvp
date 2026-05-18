"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plug,
  Calendar,
  Video,
  Users as UsersGroup,
  ExternalLink,
} from "lucide-react";

interface IntegrationsSectionProps {
  isSaving?: boolean;
}

export function IntegrationsSection({
  isSaving = false,
}: IntegrationsSectionProps) {
  const [calendlyEnabled, setCalendlyEnabled] = useState(true);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [calendlyApiKey, setCalendlyApiKey] = useState("");
  const calendlyWebhookUrl = "https://hooks.plantelligence.com/calendly";

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-accent-blue" />
              API Integrations
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Connect third-party services to enhance your workflow
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Calendly */}
        <div className="border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Calendly</h3>
                  <Badge variant="secondary" className="gap-1">
                    {calendlyEnabled ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sync meeting scheduling and availability
                </p>
              </div>
            </div>
            <Switch
              checked={calendlyEnabled}
              onCheckedChange={setCalendlyEnabled}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">API Key</label>
              <Input
                value={calendlyApiKey}
                onChange={(e) => setCalendlyApiKey(e.target.value)}
                placeholder="cal_live_••••••••••••••••••"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium mb-1">
                  Webhook URL
                </label>
                <a
                  href={calendlyWebhookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent-blue inline-flex items-center gap-1"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Input value={calendlyWebhookUrl} readOnly />
            </div>
          </div>

          <div className="mt-4 bg-accent-blue/5 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">
              Calendly Setup Instructions
            </h4>
            <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
              <li>
                <a
                  className="text-accent-blue hover:underline"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  Go to your Calendly account settings
                </a>
              </li>
              <li>Navigate to Developer → API & Webhooks</li>
              <li>Generate a new API key</li>
              <li>Copy and paste the key above</li>
            </ol>
          </div>
        </div>

        {/* Zoom */}
        <div className="border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Zoom</h3>
                  <Badge variant="secondary">
                    {zoomEnabled ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically create meeting links for virtual sessions
                </p>
              </div>
            </div>
            <Switch checked={zoomEnabled} onCheckedChange={setZoomEnabled} />
          </div>
        </div>

        {/* Microsoft Teams */}
        <div className="border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <UsersGroup className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Microsoft Teams</h3>
                  <Badge variant="secondary">
                    {teamsEnabled ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Generate Teams meeting links and calendar invites
                </p>
              </div>
            </div>
            <Switch checked={teamsEnabled} onCheckedChange={setTeamsEnabled} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="lg" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Integration Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
