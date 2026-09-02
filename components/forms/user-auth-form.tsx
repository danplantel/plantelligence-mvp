"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import GoogleSignInButton from "./google-auth-button";
import { useFormWithLoading } from "@/hooks/useFormWithLoading";
import { LoadingButton } from "@/components/ui/loading-button";
import { Eye, EyeOff } from "lucide-react";
import { signinSchema, type SigninFormValues } from "@/lib/form-schema";

interface SignInResult {
  error?: string;
}

export default function UserAuthForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const { isLoading, handleSubmit } = useFormWithLoading();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SigninFormValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SigninFormValues) => {
    await handleSubmit(async () => {
      setError(null);

      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
        callbackUrl:
          callbackUrl && callbackUrl !== null ? callbackUrl : "/dashboard",
      });

      if (result?.error) {
        // Map NextAuth error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          CredentialsSignin: "Invalid email or password. Please try again.",
          OAuthSignin: "There was a problem signing in with Google.",
          OAuthCallback: "There was a problem signing in with Google.",
          OAuthCreateAccount: "There was a problem creating your account with Google.",
          EmailCreateAccount: "There was a problem creating your account.",
          Callback: "There was a problem signing in.",
          OAuthAccountNotLinked: "This email is already associated with another sign-in method.",
          EmailSignin: "There was a problem sending the sign-in email.",
          SessionRequired: "You must be signed in to access this page.",
          default: "An unexpected error occurred. Please try again.",
        };
        setError(errorMessages[result.error] || errorMessages.default);
      } else {
        window.location.href =
          callbackUrl && callbackUrl !== null ? callbackUrl : "/dashboard";
      }
    }, "Signing in...");
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPasswordVisible(e.target.value !== "");
    form.setValue("email", e.target.value);
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={`w-full ${isPasswordVisible ? "space-y-2" : "space-y-1"}`}
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    disabled={isLoading}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleEmailChange(e);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <motion.div
            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
            animate={{
              opacity: isPasswordVisible ? 1 : 0,
              height: isPasswordVisible ? "70px" : 0,
            }}
            transition={{ duration: 0.2 }}
            className={`flex flex-col space-y-2 ${
              isPasswordVisible ? "pb-2" : ""
            }`}

            // variants={{
            //   open: { opacity: 1, height: "auto", marginBottom: "0rem" },
            //   collapsed: { opacity: 0, height: 0, marginBottom: 0 }
            // }}
          >
            {isPasswordVisible && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          disabled={isLoading}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, overflow: "hidden" }}
              animate={{ opacity: error ? 1 : 0, height: error ? "auto" : 0 }}
              transition={{ duration: 0.2 }}
              className={`flex flex-col`}
            >
              {error && <span className="text-[red] text-sm">{error}</span>}
            </motion.div>
          )}
          <LoadingButton
            isLoading={isLoading}
            loadingText="Signing in..."
            className="w-full ml-auto !mt-3 dark:bg-accent-blue dark:hover:bg-accent-blue/90"
            type="submit"
          >
            Continue with email
          </LoadingButton>
        </form>
      </Form>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="px-2 bg-background text-muted-foreground">Or</span>
        </div>
      </div>
      <GoogleSignInButton />
      <div className="flex flex-col">
        <Link
          href="/signup"
          className="mx-auto text-sm underline text-muted-foreground"
        >
          Create New Account
        </Link>
        <Link
          href="/forget"
          className="mx-auto text-sm underline text-muted-foreground"
        >
          Forgot Password?
        </Link>
      </div>
    </>
  );
}
