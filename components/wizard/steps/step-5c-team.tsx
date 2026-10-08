"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";

type InviteStatus = "pending" | "accepted";

interface TeamMemberRow {
  id: string;
  fullName: string;
  email: string;
  status: InviteStatus;
}

/**
 * Step 5c — Invite Your Team.
 *
 * Shown only when the organization's team size is above "Just me". Reached from
 * 5b Compliance Disclosures; its footer actions ("Invite Later" / "Send Invites
 * & Finish") are wired by the wizard.
 *
 * Starts with one Full Name + Email row; "Add New" appends more, each row's X
 * removes it. Filled rows (with an email) appear under "Pending Invites", where
 * each invite can be resent or cancelled.
 */
export function Step5cTeam() {
  const [rows, setRows] = useState<TeamMemberRow[]>([
    { id: "row-1", fullName: "", email: "", status: "pending" },
  ]);

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { id: `row-${Date.now()}`, fullName: "", email: "", status: "pending" },
    ]);

  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((row) => row.id !== id));

  const updateRow = (
    id: string,
    field: "fullName" | "email",
    value: string,
  ) =>
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );

  // Anything with an email counts as an invite to track.
  const pendingInvites = rows.filter((row) => row.email.trim() !== "");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Input rows */}
      <div className="space-y-4">
        <div className="text-left space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Invite Your Team
          </h2>
          <p className="text-sm text-muted-foreground">
            Invite teammates from your organization. They’ll get an email to set
            up their own profile. Your organization’s branding and settings are
            shared automatically.
          </p>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                value={row.fullName}
                onChange={(e) => updateRow(row.id, "fullName", e.target.value)}
                placeholder="Full name"
                aria-label="Full name"
                className="flex-1 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
              />
              <Input
                type="email"
                value={row.email}
                onChange={(e) => updateRow(row.id, "email", e.target.value)}
                placeholder="name@company.com"
                aria-label="Email"
                className="flex-1 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(row.id)}
                aria-label="Remove teammate"
                title="Remove teammate"
                className="shrink-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            onClick={addRow}
            className="flex items-center gap-2 bg-accent-blue text-white hover:bg-accent-blue/90"
          >
            <Plus className="h-4 w-4" />
            Add New
          </Button>
        </div>
      </div>

      {/* Pending invites */}
      <div className="space-y-3 pt-2 border-t dark:border-gray-700">
        <h3 className="text-base font-semibold text-foreground">
          Pending Invites
        </h3>

        {pendingInvites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No invites yet — add a teammate above.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#efefef] py-2 last:border-b-0 dark:border-gray-700"
              >
                <div className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium dark:text-gray-100">
                    {invite.fullName.trim() || "—"}
                  </span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{invite.email}</span>
                </div>

                <Badge
                  variant="secondary"
                  className={
                    invite.status === "accepted"
                      ? "border-transparent bg-accent-blue text-white"
                      : "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  }
                >
                  {invite.status === "accepted" ? "Accepted" : "Pending"}
                </Badge>

                <div className="flex shrink-0 items-center gap-2">
                  {/* TODO: wire Resend to the invitation resend endpoint. */}
                  <Button type="button" variant="outline" size="sm">
                    Resend
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(invite.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
