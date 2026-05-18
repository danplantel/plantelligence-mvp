"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { KeyContact } from "@/types/new-client-wizard";

type ContactOption = "call" | "appointment" | "contact";

interface KeyContactsModalProps {
  open: boolean;
  contact: KeyContact;
  onSave: (updatedContact: KeyContact) => void;
  onOpenChange: (open: boolean) => void;
}

export function KeyContactsModal({
  open,
  contact,
  onSave,
  onOpenChange,
}: KeyContactsModalProps) {
  const [switches, setSwitches] = useState<Record<ContactOption, boolean>>({
    call: contact.displayPhone || false,
    appointment: !!contact.contactUrl,
    contact: contact.displayEmail || false,
  });

  const [appointmentUrl, setAppointmentUrl] = useState(
    contact.contactUrl || "",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    setSwitches({
      call: contact.displayPhone || false,
      appointment: !!contact.contactUrl,
      contact: contact.displayEmail || false,
    });
    setAppointmentUrl(contact.contactUrl || "");
  }, [contact]);

  const handleSwitchChange = (key: ContactOption) => {
    const selectedCount = Object.values(switches).filter(Boolean).length;
    if (!switches[key] && selectedCount >= 2) {
      setError("You can enable a maximum of 2 contact options.");
      return;
    }
    setError("");
    setSwitches((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    const enabledCount = Object.values(switches).filter(Boolean).length;
    if (enabledCount === 0) {
      setError("Enable at least one contact option.");
      return;
    }

    if (switches.appointment) {
      const url = appointmentUrl.trim();
      if (!/^https?:\/\/.+/i.test(url)) {
        setError("Please enter a valid URL for scheduling (https://...).");
        return;
      }
    }

    const updatedContact: KeyContact = {
      ...contact,
      displayPhone: switches.call,
      displayEmail: switches.contact,
      displayUrl: switches.appointment,
      enableContactButton: Object.values(switches).some(Boolean),
      contactUrl: switches.appointment ? appointmentUrl : "",
    };

    onSave(updatedContact);
    onOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      const enabledCount = Object.values(switches).filter(Boolean).length;
      if (enabledCount === 0) {
        setError("Please enable at least one contact option before closing.");
        return;
      }
    }
    setError("");
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Contact Options</DialogTitle>
          {error && (
            <p className="text-red-600 text-sm mt-2 font-medium">{error}</p>
          )}
        </DialogHeader>

        <div className="space-y-5 mt-4">
          <div className="flex flex-col gap-2">
            {/* Call */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Call</p>
                <p className="text-sm text-muted-foreground">
                  Uses profile phone number by default.
                </p>
              </div>
              <Switch
                checked={switches.call}
                onCheckedChange={() => handleSwitchChange("call")}
              />
            </div>

            {/* Appointment */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Schedule an Appointment</p>
                <p className="text-sm text-muted-foreground">
                  Opens the scheduling URL for booking a meeting.
                </p>
              </div>
              <Switch
                checked={switches.appointment}
                onCheckedChange={() => handleSwitchChange("appointment")}
              />
            </div>

            {switches.appointment && (
              <Input
                className="mt-2"
                placeholder="https://your-scheduling-link.com"
                value={appointmentUrl}
                onChange={(e) => setAppointmentUrl(e.target.value)}
              />
            )}

            {/* Email */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Contact Form / Email</p>
                <p className="text-sm text-muted-foreground">
                  Links to a configurable contact form or opens an email client.
                </p>
              </div>
              <Switch
                checked={switches.contact}
                onCheckedChange={() => handleSwitchChange("contact")}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
