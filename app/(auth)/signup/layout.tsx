// app/(auth)/layout.tsx
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | PlanTelligence",
  description: "PlanTelligence sign up page",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
