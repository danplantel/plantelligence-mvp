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
import axios, { AxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "./google-auth-button";
import { signIn } from "next-auth/react";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { signupSchema, type SignupFormValues } from "@/lib/form-schema";
import { toast } from "sonner";

interface ErrorResponse {
  error: string;
}

export default function UserAuthForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailAvailability, setEmailAvailability] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    return emailRegex.test(email);
  };

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const passwordValue = form.watch("password");
  const confirmPasswordValue = form.watch("confirmPassword");
  const passwordsMatch =
    passwordValue.length > 0 &&
    confirmPasswordValue.length > 0 &&
    passwordValue === confirmPasswordValue;

  const emailValue = form.watch("email");

  // Debounced email availability check against the database.
  useEffect(() => {
    if (!emailValue || !isValidEmail(emailValue)) {
      setEmailAvailability("idle");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setEmailAvailability("checking");
      try {
        const res = await fetch(
          `/api/check-email?email=${encodeURIComponent(emailValue)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Failed to check email availability");
        const data = (await res.json()) as { available: boolean };
        if (!controller.signal.aborted) {
          setEmailAvailability(data.available ? "available" : "taken");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setEmailAvailability("idle");
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [emailValue]);

  const onSubmit = async (data: SignupFormValues) => {
    if (!isValidEmail(data.email)) {
      setError("Email is invalid");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // POST request to your signup API
      const response = await axios.post("/api/signup", {
        name: data.name,
        email: data.email,
        password: data.password,
      });
      if (response.status === 200) {
        // Automatically sign in the user after successful registration
        const result = await signIn("credentials", {
          email: data.email,
          password: data.password,
          redirect: false,
        });

        if (result?.ok) {
          toast.success("Account created successfully");
          router.push("/onboarding");
        } else {
          toast.success("Account created successfully. Please sign in.");
          router.push("/signin");
        }
      } else {
        throw new Error(response.data.message || "Registration failed");
      }
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      if (axiosError.response) {
        setError(axiosError.response.data.error || "Registration failed");
      } else {
        setError("Registration failed");
      }
    }
    setLoading(false);
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full space-y-2"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    maxLength={100}
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      maxLength={254}
                      disabled={loading}
                      {...field}
                    />
                    {emailAvailability === "checking" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {emailAvailability === "available" && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                </FormControl>
                {emailAvailability === "taken" && (
                  <p className="text-[0.8rem] text-destructive mt-1">
                    This email is already registered.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

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
                      disabled={loading}
                      {...field}
                    />
                    {passwordsMatch && (
                      <CheckCircle2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <p className="text-[0.8rem] text-muted-foreground mt-1">
                  Must be at least 8 characters with uppercase, lowercase, number & special character.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verify Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      disabled={loading}
                      {...field}
                    />
                    {passwordsMatch && (
                      <CheckCircle2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
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

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
              className="flex flex-col"
            >
              <span className="text-[red] text-sm">{error}</span>
            </motion.div>
          )}
          <div className="flex flex-col">
            <Link
              className="text-sm underline text-muted-foreground"
              href="/signin"
            >
              Already have an account?
            </Link>
          </div>
          <Button
            disabled={
              loading ||
              !form.formState.isValid ||
              emailAvailability === "taken"
            }
            className="w-full ml-auto !mt-3 dark:bg-accent-blue dark:hover:bg-accent-blue/90"
            type="submit"
          >
            {loading ? "Loading..." : "Sign Up"}
          </Button>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 bg-background text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          <GoogleSignInButton />
        </form>
      </Form>
    </>
  );
}
