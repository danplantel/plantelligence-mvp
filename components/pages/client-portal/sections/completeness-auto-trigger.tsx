"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getBenefitCompleteness } from "@/lib/benefit-completeness";
import { mergePlanDocumentRows } from "@/lib/plan-client-documents-merge";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import { IncompleteBenefitDialog } from "./incomplete-benefit-dialog";
import { BenefitsCategory } from "@/types/new-client-wizard";

interface CompletenessAutoTriggerProps {
  category: BenefitsCategory;
  clientData: any;
  clientId: string;
}

export function CompletenessAutoTrigger({
  category,
  clientData,
  clientId,
}: CompletenessAutoTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [missingInfo, setMissingInfo] = useState<string[]>([]);

  /** Same fingerprint as retirement page — only re-merge docs when embedded id set changes. */
  const documentsSig = useMemo(() => {
    const d = clientData?.documents;
    if (!Array.isArray(d)) return "";
    return `${d.length}:${d
      .map((x: { id?: string }) => String(x?.id ?? ""))
      .sort()
      .join(",")}`;
  }, [clientData?.documents]);

  const clientRef = useRef(clientData);
  clientRef.current = clientData;

  const [mergedDocuments, setMergedDocuments] = useState<unknown[] | null>(
    null,
  );

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    (async () => {
      const apiRows = await fetchPlanDocumentsForClient(clientId);
      if (cancelled) return;

      const embedded = Array.isArray(clientRef.current?.documents)
        ? clientRef.current.documents
        : [];

      setMergedDocuments(
        mergePlanDocumentRows(apiRows as unknown[], embedded as unknown[]),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, documentsSig]);

  useEffect(() => {
    const cd = clientRef.current;
    if (!cd) return;

    const docs =
      mergedDocuments !== null ? mergedDocuments : cd.documents ?? [];

    const snapshot = {
      ...cd,
      documents: docs,
    };

    const completeness = getBenefitCompleteness(category, snapshot);

    if (!completeness.isComplete) {
      setMissingInfo(completeness.missingInfo);
      setIsOpen(true);
    } else {
      setMissingInfo([]);
      setIsOpen(false);
    }
  }, [category, clientData, mergedDocuments, clientId]);

  return (
    <IncompleteBenefitDialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      category={category}
      missingInfo={missingInfo}
      clientId={clientId}
    />
  );
}
