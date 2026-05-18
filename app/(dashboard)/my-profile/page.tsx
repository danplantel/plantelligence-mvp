import { Metadata } from "next";
import Profile from "@/components/pages/my-profile";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Manage your profile settings.",
};

export default function ProfilePage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">My Profile</h2>
      </div>
      <Profile />
    </div>
  );
}
