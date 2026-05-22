"use client";

import { User, Mail, Phone, Briefcase, Award } from "lucide-react";
import { Headshot } from "@/components/ui/headshot";
import { SummaryUserSetupSectionProps } from "./summary-user-setup-section.funcs";
import { formatPhoneNumber } from "../user-setup-section/user-setup-section.funcs";

export function SummaryUserSetupSection({
  name,
  email,
  phone,
  phoneExtension,
  title,
  designations,
  headshot,
  saveAsContact,
}: SummaryUserSetupSectionProps) {
  return (
    <div className="space-y-3 px-4">
      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4" />
        <h3 className="font-semibold text-base">User Setup</h3>
      </div>

      <div className="space-y-2">
        {/* Name */}
        <div>
          <label className="font-medium text-muted-foreground text-sm">
            Name
          </label>
          <p className="text-sm">{name || "Not provided"}</p>
        </div>

        {/* Email */}
        <div>
          <label className="font-medium text-muted-foreground text-sm">
            Email
          </label>
          <p className="text-sm">{email || "Not provided"}</p>
        </div>

        {/* Phone */}
        <div>
          <label className="font-medium text-muted-foreground text-sm">
            Phone
          </label>
          <p className="text-sm">
            {phone ? formatPhoneNumber(phone) : "Not provided"}
            {phone && phoneExtension && (
              <span> Ext. {phoneExtension}</span>
            )}
          </p>
        </div>

        {/* Title */}
        <div>
          <label className="font-medium text-muted-foreground text-sm">
            Title
          </label>
          <p className="text-sm">{title || "Not provided"}</p>
        </div>

        {/* Designations */}
        {designations && designations.length > 0 && (
          <div>
            <label className="font-medium text-muted-foreground text-base">
              Designations
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {designations.map((designation, index) => (
                <span
                  key={index}
                  className="inline-flex items-center bg-blue-100 px-2 py-1 rounded-full text-blue-800 text-xs"
                >
                  <Award className="mr-1 w-3 h-3" />
                  {designation}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Save as Contact */}
        <div>
          <label className="font-medium text-muted-foreground text-sm">
            Save as Contact
          </label>
          <p className="text-sm">
            {saveAsContact !== false ? "Yes" : "No"}
          </p>
        </div>

        {/* Headshot preview (photo or monogram) */}
        <div>
          <label className="font-medium text-muted-foreground text-base">
            Headshot
          </label>
          <div className="mt-1 w-12 h-12 rounded-full overflow-hidden border border-border">
            <Headshot
              src={headshot || undefined}
              monogramName={name}
              alt="User headshot"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
