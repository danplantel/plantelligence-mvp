"use client";

import { useState } from "react";
import { License } from "@/types/wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  usStates,
  createNewLicense,
  createDuplicateLicense,
  createDuplicateLicensesForState,
} from "./add-licenses-section.funcs";
import {
  Plus,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";
import { StateSelect } from "../state-select";
import { LicenseRow } from "../license-row";

interface AddLicensesSectionProps {
  licenses: License[];
  onLicensesChange: (licenses: License[]) => void;
  validationErrors?: {
    [licenseId: string]: {
      type?: string;
      customType?: string;
      number?: string;
    };
  };
}

export function AddLicensesSection({
  licenses,
  onLicensesChange,
  validationErrors,
}: AddLicensesSectionProps) {
  const [expandedStates, setExpandedStates] = useState<string[]>([]);
  const addState = () => {
    // Find next available state
    const usedStates = new Set(licenses.map((license) => license.state));
    const availableStates = usStates.filter((state) => !usedStates.has(state));

    if (availableStates.length === 0) {
      return; // No more states available
    }

    const newState = availableStates[0];
    const newLicense = createNewLicense(newState);

    onLicensesChange([...licenses, newLicense]);
    setExpandedStates([...expandedStates, newState]);
  };

  const changeState = (oldState: string, newState: string) => {
    if (oldState === newState) return;

    // Check if new state already exists
    const stateExists = licenses.some((license) => license.state === newState);
    if (stateExists) return;

    // Update all licenses from old state to new state
    const updatedLicenses = licenses.map((license) =>
      license.state === oldState ? { ...license, state: newState } : license,
    );

    onLicensesChange(updatedLicenses);

    // Update expanded states
    setExpandedStates(
      expandedStates.map((state) => (state === oldState ? newState : state)),
    );
  };

  const addLicenseToState = (state: string) => {
    const newLicense = createNewLicense(state);
    onLicensesChange([...licenses, newLicense]);
  };

  const updateLicense = (id: string, updates: Partial<License>) => {
    const updatedLicenses = licenses.map((license) =>
      license.id === id ? { ...license, ...updates } : license,
    );
    onLicensesChange(updatedLicenses);
  };

  const removeLicense = (id: string) => {
    const updatedLicenses = licenses.filter((license) => license.id !== id);
    onLicensesChange(updatedLicenses);
  };

  const duplicateLicense = (id: string) => {
    const licenseToDuplicate = licenses.find((license) => license.id === id);
    if (licenseToDuplicate) {
      const duplicatedLicense = createDuplicateLicense(licenseToDuplicate);
      onLicensesChange([...licenses, duplicatedLicense]);
    }
  };

  const duplicateState = (state: string) => {
    const stateLicenses = getStateLicenses(state);
    if (stateLicenses.length === 0) return;

    // Find next available state
    const usedStates = new Set(licenses.map((license) => license.state));
    const availableStates = usStates.filter(
      (stateOption) => !usedStates.has(stateOption),
    );

    if (availableStates.length === 0) {
      return; // No more states available
    }

    const newState = availableStates[0];
    const duplicatedLicenses = createDuplicateLicensesForState(
      stateLicenses,
      newState,
    );

    onLicensesChange([...licenses, ...duplicatedLicenses]);
    setExpandedStates([...expandedStates, newState]);
  };

  const removeState = (state: string) => {
    const updatedLicenses = licenses.filter(
      (license) => license.state !== state,
    );
    onLicensesChange(updatedLicenses);
    setExpandedStates(expandedStates.filter((s) => s !== state));
  };

  const getStateLicenses = (state: string) => {
    return licenses.filter((license) => license.state === state);
  };

  const getUniqueStates = () => {
    return Array.from(new Set(licenses.map((license) => license.state)));
  };

  const toggleStateExpansion = (state: string) => {
    if (expandedStates.includes(state)) {
      setExpandedStates(expandedStates.filter((s) => s !== state));
    } else {
      setExpandedStates([...expandedStates, state]);
    }
  };

  const isStateExpanded = (state: string) => {
    return expandedStates.includes(state);
  };

  return (
    <Card className="shadow-none overflow-visible">
      <CardHeader>
        <div className="flex justify-between items-center gap-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent-blue" />
            Add Licenses
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 overflow-visible">
        {licenses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No licenses added yet</p>
            <Button
              variant="ghost"
              onClick={addState}
              className="mt-4 text-accent-blue hover:bg-muted/50 "
            >
              <Plus className="size-6 mr-2" />
              Add License
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {getUniqueStates().map((state) => (
              <Card key={state} className="shadow-sm overflow-visible">
                <CardHeader
                  className={`cursor-pointer hover:bg-[#23919C]/10 transition-colors rounded-xl overflow-visible ${
                    isStateExpanded(state)
                      ? "bg-[#23919C]/10 hover:bg-[#23919C]/5 rounded-b-none"
                      : ""
                  }`}
                  onClick={() => toggleStateExpansion(state)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          side="left"
                          sideOffset={4}
                        >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateState(state);
                            }}
                          >
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              removeState(state);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <StateSelect
                            value={state}
                            onValueChange={(newState) =>
                              changeState(state, newState)
                            }
                            disabledStates={licenses
                              .map((license) => license.state)
                              .filter((stateOption) => stateOption !== state)}
                          />
                          <span className="text-sm text-muted-foreground">
                            State
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Select the state that issued this license.311
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isStateExpanded(state) ? (
                        <ChevronDown className="size-6 text-accent-blue" />
                      ) : (
                        <ChevronRight className="size-6 text-accent-blue" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isStateExpanded(state) && (
                  <CardContent className="space-y-2.5 mt-2.5 pb-2 px-4 overflow-visible">
                    {getStateLicenses(state).map((license) => (
                      <LicenseRow
                        key={license.id}
                        license={license}
                        onUpdate={updateLicense}
                        onDuplicate={duplicateLicense}
                        onDelete={removeLicense}
                        errors={validationErrors?.[license.id]}
                      />
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addLicenseToState(state)}
                      className="text-accent-blue border-none shadow-none hover:bg-muted/50 py-6"
                    >
                      <Plus className="size-6 mr-2" />
                      Add Row
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))}

            <Button
              onClick={addState}
              variant="outline"
              className="text-accent-blue border-none shadow-none hover:bg-muted/50 py-6"
            >
              <Plus className="size-6 mr-2" />
              Add License
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
