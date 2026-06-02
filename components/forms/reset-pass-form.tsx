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
import axios, { AxiosError } from 'axios';
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/form-schema";

interface APIErrorResponse {
  error: string;
}

export default function ResetPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useSearchParams();
  const email = params.get('email') ?? "";

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: ""
    },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setLoading(true);
    setError(null);

    try {
      // POST request to your reset password API
      const response = await axios.post('/api/reset-password', {
        email: email,
        newPassword: data.password,
      });
      if (response.status === 200) {
        window.location.href = "/signin"; 
      } else {
        throw new Error(response.data.message || 'Password reset failed');
      }
    }  catch (error) {
      const axiosError = error as AxiosError<APIErrorResponse>;
      if (axiosError.response) {
        setError(axiosError.response.data.error || 'Reset request failed');
      } else {
        setError('An unexpected error occurred');
      }
    }

    setLoading(false);
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-1">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    disabled={loading}
                    {...field}
                  />
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
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    disabled={loading}
                    {...field}
                  />
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
              className="flex flex-col pb-2 space-y-2"
            >
              <span className="text-sm text-red-500">{error}</span>
            </motion.div>
          )}

          <Button disabled={loading} className="w-full ml-auto !mt-3" type="submit">
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </Form>
    </>
  );
}
