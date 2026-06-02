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
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const formSchema = z.object({
  email: z.string().email({ message: "Enter a valid email address" }),
});

interface APIErrorResponse {
  error: string;
}

type ForgetPasswordFormValues = z.infer<typeof formSchema>;

export default function ForgetPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useRouter();

  useEffect(() => {
    if (error) {
      setTimeout(() => {
        setError(null);
      }, 8000);
    }
  }, [error]);

  const form = useForm<ForgetPasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgetPasswordFormValues) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/forget', {
        email: data.email,
      });
      if (response.status === 200) {
        toast.success('Please check your email for password reset instructions');
        navigation.replace(`/verify-code?email=${data.email}`);
      } else {
        throw new Error(response.data.message || 'Reset request failed');
      }
    } catch (error) {
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-2">
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
              className="flex flex-col"
            >
              <span className="text-sm text-red-500">{error}</span>
            </motion.div>
          )}

          <Button disabled={loading} className="w-full ml-auto !mt-3" type="submit">
            {loading ? "Sending..." : "Forget Password"}
          </Button>
        </form>
      </Form>
    </>
  );
}
