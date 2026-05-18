"use client";

import { useState, useEffect } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QrCode, Eye } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  mapKeyContactsToContactInfo,
  type ContactInformation,
  type ContactType,
} from "@/lib/contact-info";

interface VideoStep5aProps {
  errorFields?: string[];
}

function ErrorMessage({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <p className="text-sm text-red-500 mt-1">{error}</p>;
}

export function VideoStep5a({ errorFields = [] }: VideoStep5aProps) {
  const { stepData, saveStepDataLocally, nextStep } = useVideoWizardStore();
  const { data: session } = useSession();
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Get saved data or initialize
  const step5aData = (stepData as any).step5a || {};
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;

  // Initialize state from saved data or plan data
  const [financialPlanning, setFinancialPlanning] = useState<boolean | null>(
    step5aData.financialPlanning !== undefined
      ? step5aData.financialPlanning
      : selectedPlan?.resources?.financialPlanning !== undefined
      ? selectedPlan.resources.financialPlanning
      : null,
  );

  const emptyContactInformation: ContactInformation = {
    primaryType: "None",
    primaryTypeCustom: "",
    primaryName: "",
    primaryEmail: "",
    primaryPhone: "",
    secondaryType: "None",
    secondaryTypeCustom: "",
    secondaryName: "",
    secondaryEmail: "",
    secondaryPhone: "",
    tertiaryType: "None",
    tertiaryTypeCustom: "",
    tertiaryName: "",
    tertiaryEmail: "",
    tertiaryPhone: "",
    planId: "",
  };

  // Initialize contactInformation from saved data, plan data, or keyContacts
  const getInitialContactInfo = (): ContactInformation => {
    // First priority: saved step5a data
    if (step5aData.contactInformation) {
      return {
        ...emptyContactInformation,
        ...step5aData.contactInformation,
        planId:
          step5aData.contactInformation?.planId ||
          selectedPlan?.resources?.contactInformation?.planId ||
          "",
      };
    }

    // Second priority: plan data
    if (selectedPlan?.resources?.contactInformation) {
      return {
        ...emptyContactInformation,
        ...selectedPlan.resources.contactInformation,
      };
    }

    // Default: empty structure
    return emptyContactInformation;
  };

  const [contactInformation, setContactInformation] =
    useState<ContactInformation>(getInitialContactInfo());

  const [qrUrl, setQrUrl] = useState<string>(
    step5aData.qrUrl || selectedPlan?.resources?.qrUrl || "",
  );
  const [qrLinkGenerated, setQrLinkGenerated] = useState<boolean>(
    step5aData.qrLinkGenerated || false,
  );
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Load Key Contacts from Client on mount
  useEffect(() => {
    const loadKeyContacts = async () => {
      // Only load if we don't have saved contactInformation and no plan data
      if (
        step5aData.contactInformation ||
        selectedPlan?.resources?.contactInformation
      ) {
        return; // Already have data, don't overwrite
      }

      if (!session?.user?.id || !selectedPlan) return;

      setIsLoadingContacts(true);
      try {
        // Get clients for the user
        const clientsResponse = await fetch("/api/clients?status=all");
        if (!clientsResponse.ok) {
          throw new Error("Failed to fetch clients");
        }
        const clientsData = await clientsResponse.json();
        const clients = clientsData.data || clientsData.clients || [];

        // Find client that matches the selected plan's company name
        // Match by companyName or clientName from plan
        const planCompanyName =
          selectedPlan?.companyName || selectedPlan?.clientName;

        const clientWithContacts = clients.find((client: any) => {
          const matchesCompany = client.companyName === planCompanyName;
          const hasContacts =
            client.keyContacts &&
            Array.isArray(client.keyContacts) &&
            client.keyContacts.length > 0;
          return matchesCompany && hasContacts;
        });

        if (clientWithContacts?.keyContacts) {
          
          const mappedContacts = mapKeyContactsToContactInfo(
            clientWithContacts.keyContacts,
          );
          if (mappedContacts) {
            setContactInformation((prev: typeof contactInformation) => ({
              ...prev,
              ...mappedContacts,
              planId:
                prev.planId ||
                selectedPlan?.resources?.contactInformation?.planId ||
                selectedPlan?.id ||
                "",
            }));
          }
        } else {
        }
      } catch (error) {
        console.error("Error loading key contacts:", error);
      } finally {
        setIsLoadingContacts(false);
      }
    };

    loadKeyContacts();
  }, [
    session?.user?.id,
    step5aData.contactInformation,
    selectedPlan?.resources?.contactInformation,
    selectedPlan?.companyName,
    selectedPlan?.clientName,
  ]);

  // Save data when it changes
  useEffect(() => {
    saveStepDataLocally("step5a", {
      financialPlanning,
      contactInformation,
      qrUrl,
      qrLinkGenerated,
    });
  }, [
    financialPlanning,
    contactInformation,
    qrUrl,
    qrLinkGenerated,
    saveStepDataLocally,
  ]);

  const handleContactInfoChange = (
    field: keyof ContactInformation,
    value: string | ContactType,
  ) => {
    setContactInformation((prev) => ({
      ...prev,
      [field]: value as ContactInformation[keyof ContactInformation],
    }));
  };

  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-gray-900 dark:text-white">
          Resources & Contact Information
        </CardTitle>
        <p className="text-gray-500 mt-1">
          Configure contact information and resources for your plan
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>We offer financial planning</Label>
          <div className="flex space-x-4">
            <Button
              type="button"
              variant={financialPlanning ? "default" : "outline"}
              onClick={() => setFinancialPlanning(true)}
              className="flex-1"
            >
              Yes
            </Button>
            <Button
              type="button"
              variant={!financialPlanning ? "default" : "outline"}
              onClick={() => setFinancialPlanning(false)}
              className="flex-1"
            >
              No
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Primary Contact Type</Label>
            <Select
              value={contactInformation.primaryType}
              onValueChange={(value: ContactType) =>
                handleContactInfoChange("primaryType", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select primary contact type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Phone">Phone</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
                <SelectItem value="None">None</SelectItem>
              </SelectContent>
            </Select>
            {contactInformation.primaryType === "Custom" && (
              <Input
                className="mt-2"
                placeholder="Enter custom contact type"
                value={contactInformation.primaryTypeCustom}
                onChange={(e) =>
                  handleContactInfoChange("primaryTypeCustom", e.target.value)
                }
              />
            )}
          </div>

          <div>
            <Label>Primary Contact Name</Label>
            <Input
              value={contactInformation.primaryName}
              onChange={(e) =>
                handleContactInfoChange("primaryName", e.target.value)
              }
            />
          </div>

          <div>
            <Label>Primary Contact Email</Label>
            <Input
              value={contactInformation.primaryEmail}
              onChange={(e) =>
                handleContactInfoChange("primaryEmail", e.target.value)
              }
            />
          </div>

          <div>
            <Label>Primary Contact Phone</Label>
            <Input
              value={contactInformation.primaryPhone}
              onChange={(e) =>
                handleContactInfoChange("primaryPhone", e.target.value)
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Secondary Contact Type</Label>
          <Select
            value={contactInformation.secondaryType}
            onValueChange={(value: ContactType) =>
              handleContactInfoChange("secondaryType", value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select secondary contact type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Phone">Phone</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
              <SelectItem value="None">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {contactInformation.secondaryType === "Custom" && (
          <div className="space-y-2">
            <Label>Custom Secondary Type</Label>
            <Input
              value={contactInformation.secondaryTypeCustom}
              onChange={(e) =>
                handleContactInfoChange("secondaryTypeCustom", e.target.value)
              }
              placeholder="Enter custom secondary type"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Secondary Name</Label>
          <Input
            value={contactInformation.secondaryName}
            onChange={(e) =>
              handleContactInfoChange("secondaryName", e.target.value)
            }
            placeholder="Enter secondary contact name"
          />
        </div>

        {contactInformation.secondaryType === "Email" && (
          <div className="space-y-2">
            <Label>Secondary Email</Label>
            <Input
              value={contactInformation.secondaryEmail}
              onChange={(e) =>
                handleContactInfoChange("secondaryEmail", e.target.value)
              }
              placeholder="Enter secondary contact email"
            />
          </div>
        )}

        {contactInformation.secondaryType === "Phone" && (
          <div className="space-y-2">
            <Label>Secondary Phone</Label>
            <Input
              value={contactInformation.secondaryPhone}
              onChange={(e) =>
                handleContactInfoChange("secondaryPhone", e.target.value)
              }
              placeholder="Enter secondary contact phone"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Tertiary Contact Type</Label>
          <Select
            value={contactInformation.tertiaryType}
            onValueChange={(value: ContactType) =>
              handleContactInfoChange("tertiaryType", value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tertiary contact type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Phone">Phone</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
              <SelectItem value="None">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {contactInformation.tertiaryType === "Custom" && (
          <div className="space-y-2">
            <Label>Custom Tertiary Type</Label>
            <Input
              value={contactInformation.tertiaryTypeCustom}
              onChange={(e) =>
                handleContactInfoChange("tertiaryTypeCustom", e.target.value)
              }
              placeholder="Enter custom tertiary type"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Tertiary Name</Label>
          <Input
            value={contactInformation.tertiaryName}
            onChange={(e) =>
              handleContactInfoChange("tertiaryName", e.target.value)
            }
            placeholder="Enter tertiary contact name"
          />
        </div>

        {contactInformation.tertiaryType === "Email" && (
          <div className="space-y-2">
            <Label>Tertiary Email</Label>
            <Input
              value={contactInformation.tertiaryEmail}
              onChange={(e) =>
                handleContactInfoChange("tertiaryEmail", e.target.value)
              }
              placeholder="Enter tertiary contact email"
            />
          </div>
        )}

        {contactInformation.tertiaryType === "Phone" && (
          <div className="space-y-2">
            <Label>Tertiary Phone</Label>
            <Input
              value={contactInformation.tertiaryPhone}
              onChange={(e) =>
                handleContactInfoChange("tertiaryPhone", e.target.value)
              }
              placeholder="Enter tertiary contact phone"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Plan ID</Label>
          <Input
            value={contactInformation.planId}
            onChange={(e) => handleContactInfoChange("planId", e.target.value)}
            placeholder="Enter plan ID"
          />
        </div>

        <div className="space-y-2">
          <Label>QR URL</Label>
          <Input
            value={qrUrl}
            onChange={(e) => setQrUrl(e.target.value)}
            placeholder="Enter QR URL"
          />
        </div>

        <div className="space-y-2">
          <Label>QR Code</Label>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                if (qrUrl) {
                  setQrLinkGenerated(true);
                }
              }}
              className="flex items-center border-2 border-gray-300 hover:border-gray-400 transition-colors"
              disabled={!qrUrl}
            >
              <QrCode className="mr-2 h-4 w-4" /> Generate QR Code
            </Button>
          </div>
          {qrLinkGenerated && qrUrl && (
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-2">
                <QRCodeSVG value={qrUrl} size={64} />
                <span className="text-sm text-gray-500">{qrUrl}</span>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="flex items-center"
                size="sm"
              >
                <Eye className="mr-2 h-4 w-4" /> View in Modal
              </Button>
            </div>
          )}
        </div>

        {/* QR Code Modal */}
        <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center space-y-4 py-6">
              {qrUrl && (
                <>
                  <QRCodeSVG value={qrUrl} size={256} />
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      QR Code URL:
                    </p>
                    <p className="text-sm text-gray-500 break-all px-4">
                      {qrUrl}
                    </p>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
