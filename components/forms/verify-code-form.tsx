// components/forms/verify-code-form.tsx

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
import * as z from "zod";
import { useRouter, useSearchParams } from "next/navigation";

const formSchema = z.object({
  code: z.string().min(6, "Code must be 6 digits").max(6, "Code must be 6 digits"),
});
interface ErrorResponse {
  error: string;
}

type VerifyCodeFormValues = z.infer<typeof formSchema>;

export default function VerifyCodeForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation =  useRouter();
  const params =  useSearchParams();
  const email =  params.get('email') ?? "";  

  const form = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
    },
  });

  const onSubmit = async (data: VerifyCodeFormValues) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/verify-code', {
        email: email,
        code: data.code,
      });
      if (response.status === 200) {
        navigation.replace(`/reset-password?email=${email}`);
      } else {
        throw new Error(response.data.message || 'Verification failed');
      }
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      if (axiosError.response) {
        setError(axiosError.response.data.error || 'Verification failed');
      } else {
        setError('Verification failed');
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
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verification Code</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Enter your 6-digit code"
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
            {loading ? "Verifying..." : "Verify Code"}
          </Button>
        </form>
      </Form>
    </>
  );
}
