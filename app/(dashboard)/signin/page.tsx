import { Metadata } from "next";
import UserAuthForm from "@/components/forms/user-auth-form";
import SignIn from "@/components/pages/sign-in";

export const metadata: Metadata = {
  title: "Sign In | PlanTelligence",
  description: "PlanTelligence sign in page",
};

export default function AuthenticationPage() {
  return <SignIn />;
}
