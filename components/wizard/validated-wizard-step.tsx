"use client";

import { ReactNode } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface ValidatedWizardStepProps {
  schema: z.ZodSchema<any>;
  defaultValues?: any;
  children: ReactNode;
  onSubmit?: (data: any) => void;
  className?: string;
}

export function ValidatedWizardStep({
  schema,
  defaultValues = {},
  children,
  onSubmit,
  className = "",
}: ValidatedWizardStepProps) {
  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
  });

  const handleSubmit = (data: any) => {
    if (onSubmit) {
      onSubmit(data);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} className={className}>
        {children}
      </form>
    </FormProvider>
  );
}

// Hook to get form state from any child component
export function useWizardForm() {
  const methods = useForm();
  return methods;
}
