import { TeamMember } from "@/types/wizard";

export interface AddTeamMembersSectionProps {
  isVisible: boolean;
}

export interface AddTeamMembersState {
  members: TeamMember[];
}

export interface AddTeamMembersActions {
  onAddMember: () => void;
  onUpdateMember: (index: number, field: keyof TeamMember, value: string | boolean) => void;
  onRemoveMember: (index: number) => void;
}

export const createNewMember = (): TeamMember => ({
  name: "",
  email: "",
  role: "",
});

export const onAddMember = (
  members: TeamMember[],
  setMembers: (members: TeamMember[]) => void,
  saveStepDataLocally: (key: string, data: any) => void
) => {
  const newMember = createNewMember();
  const newMembers = [...members, newMember];
  setMembers(newMembers);
  saveStepDataLocally("teamMembers", { members: newMembers });
};

export const onUpdateMember = (
  index: number,
  field: keyof TeamMember,
  value: string | boolean,
  members: TeamMember[],
  setMembers: (members: TeamMember[]) => void,
  saveStepDataLocally: (key: string, data: any) => void
) => {
  const newMembers = members.map((member, i) =>
    i === index ? { ...member, [field]: value } : member,
  );
  setMembers(newMembers);
  saveStepDataLocally("teamMembers", { members: newMembers });
};

export const onRemoveMember = (
  index: number,
  members: TeamMember[],
  setMembers: (members: TeamMember[]) => void,
  saveStepDataLocally: (key: string, data: any) => void
) => {
  const newMembers = members.filter((_, i) => i !== index);
  setMembers(newMembers);
  saveStepDataLocally("teamMembers", { members: newMembers });
};

export const onSendInvite = async (
  index: number,
  member: TeamMember,
  members: TeamMember[],
  setMembers: (members: TeamMember[]) => void,
  saveStepDataLocally: (key: string, data: any) => void
) => {
  // TODO: Implement actual invite sending logic
  // For now, just mark as invite sent and show message
  alert(`Invite email functionality will be implemented later. For now, team member "${member.name}" has been added with ${member.role} role.`);
  
  const newMembers = members.map((m, i) =>
    i === index ? { ...m, inviteSent: true } : m
  );
  setMembers(newMembers);
  saveStepDataLocally("teamMembers", { members: newMembers });
};

export const roleOptions = [
  { 
    value: "admin", 
    label: "Admin",
    description: "Full access (same as account owner). Manage billing, users, branding, disclaimers, and all client/plan data."
  },
  { 
    value: "manager", 
    label: "Manager",
    description: "Can edit client/plan portals, upload documents, and manage content. Cannot manage billing, global settings, or delete the account."
  },
  { 
    value: "assistant", 
    label: "Assistant",
    description: "Can edit text, upload docs, and manage participant-facing materials. Cannot invite users, manage billing, or delete content."
  },
  { 
    value: "viewer", 
    label: "Viewer",
    description: "Read-only access. Can view content but cannot make changes."
  },
  { 
    value: "other", 
    label: "Other",
    description: "Custom role for future permissions."
  },
];
