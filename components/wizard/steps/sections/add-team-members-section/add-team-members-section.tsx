"use client";

import { useState, useEffect } from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { TeamMember } from "@/types/wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Mail, CheckCircle, Users } from "lucide-react";
import {
  AddTeamMembersSectionProps,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
  onSendInvite,
  roleOptions,
} from "./add-team-members-section.funcs";

export function AddTeamMembersSection({
  isVisible,
  hideCard = false,
}: AddTeamMembersSectionProps & { hideCard?: boolean }) {
  const { saveStepDataLocally, stepData } = useOnboardingWizardStore();

  // Team Members state
  const [members, setMembers] = useState<TeamMember[]>(
    stepData.teamMembers?.members || [],
  );
  const [sendingInvites, setSendingInvites] = useState<Set<number>>(new Set());

  // Update state when stepData changes (when data is loaded from server)
  useEffect(() => {
    if (stepData.teamMembers?.members) {
      setMembers(stepData.teamMembers.members);
    }
  }, [stepData.teamMembers?.members]);

  const onAddMemberClick = () => {
    onAddMember(members, setMembers, saveStepDataLocally);
  };

  const onUpdateMemberClick = (
    index: number,
    field: keyof TeamMember,
    value: string | boolean,
  ) => {
    onUpdateMember(
      index,
      field,
      value,
      members,
      setMembers,
      saveStepDataLocally,
    );
  };

  const onRemoveMemberClick = (index: number) => {
    onRemoveMember(index, members, setMembers, saveStepDataLocally);
  };

  const onSendInviteClick = async (index: number) => {
    const member = members[index];
    if (!member.email || !member.name || !member.role) {
      alert("Please fill in name, email, and role before sending invite");
      return;
    }

    setSendingInvites((prev) => new Set(prev).add(index));

    try {
      await onSendInvite(
        index,
        member,
        members,
        setMembers,
        saveStepDataLocally,
      );
    } catch (error) {
      alert("Failed to send invite. Please try again.");
    } finally {
      setSendingInvites((prev) => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  if (!isVisible) {
    return null;
  }

  const content = (
    <div className="space-y-2">
      {members.length === 0 ? (
        <div className="text-center py-3 text-muted-foreground">
          <p className="text-xs">No team members added yet</p>
          <Button
            variant="ghost"
            onClick={onAddMemberClick}
            className="mt-1 text-accent-blue hover:bg-muted/50 h-7 text-xs"
          >
            <Plus className="size-4 mr-1" />
            Add Team Member
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
            <div>Name</div>
            <div>Email</div>
            <div>Role</div>
            <div>Action</div>
          </div>

          {members.map((member, index) => (
            <div key={index} className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddMemberClick();
                    }}
                  >
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveMemberClick(index);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                {/* Name Field */}
                <div>
                  <Input
                    value={member.name}
                    onChange={(e) =>
                      onUpdateMemberClick(index, "name", e.target.value)
                    }
                    placeholder="Full Name"
                    required
                    className="h-8 text-xs"
                  />
                </div>

                {/* Email Field */}
                <div>
                  <Input
                    type="email"
                    value={member.email}
                    onChange={(e) =>
                      onUpdateMemberClick(index, "email", e.target.value)
                    }
                    placeholder="Email"
                    required
                    className="h-8 text-xs"
                  />
                </div>

                {/* Role Dropdown */}
                <div>
                  <Select
                    value={member.role}
                    onValueChange={(value) =>
                      onUpdateMemberClick(index, "role", value)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      {member.role ? (
                        <span className="font-medium">
                          {roleOptions.find(
                            (role) => role.value === member.role,
                          )?.label || member.role}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Select role
                        </span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div>
                            <div className="font-medium text-xs">{role.label}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {role.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Send Invite Button */}
                <div className="flex items-center">
                  {member.inviteSent ? (
                    <div className="flex items-center text-green-600 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Invite Sent
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onSendInviteClick(index)}
                      disabled={
                        sendingInvites.has(index) ||
                        !member.name ||
                        !member.email ||
                        !member.role
                      }
                      className="h-7 px-2 text-[11px] w-full"
                    >
                      {sendingInvites.has(index) ? (
                        <>
                          <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-white mr-1" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="w-3 h-3 mr-1" />
                          Send Invite
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          <Button
            onClick={onAddMemberClick}
            variant="outline"
            className="text-accent-blue border-none shadow-none hover:bg-muted/50 py-3 h-9 text-xs"
          >
            <Plus className="size-4 mr-1.5" />
            Add Team Member
          </Button>
        </div>
      )}
    </div>
  );

  if (hideCard) {
    return content;
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-blue" />
            Add Team Members
          </CardTitle>
        </div>
        <p className="text-muted-foreground font-light">
          Who else needs access? (Optional)
        </p>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
