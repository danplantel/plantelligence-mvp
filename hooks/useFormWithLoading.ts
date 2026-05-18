import { useLoading } from "@/contexts/loading-context";
import { useCallback } from "react";

export function useFormWithLoading() {
  const { setLoading, isLoading } = useLoading();

  const handleSubmit = useCallback(
    async (
      submitFn: () => Promise<void>,
      loadingMessage: string = "Processing..."
    ) => {
      setLoading(true, loadingMessage);
      try {
        await submitFn();
      } finally {
        setLoading(false);
      }
    },
    [setLoading]
  );

  return {
    isLoading,
    handleSubmit,
    setLoading,
  };
}

