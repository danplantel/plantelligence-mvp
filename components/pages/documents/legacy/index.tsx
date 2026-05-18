"use client";

import { Button } from "@/components/ui/button";
import {
  ExternalLinkIcon,
  FileTextIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons";
import React, { useState, useEffect } from "react";
import ExternalLinks from "./ExternalLinks";
import PlanDocuments from "./PlanDocuments";

const Documents = () => {
  const [externalOpen, setExternalOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <div>
      <ExternalLinks
        isOpen={externalOpen}
        onClose={() => setExternalOpen(false)}
      />

      <PlanDocuments isOpen={planOpen} onClose={() => setPlanOpen(false)} />

      <div className="!mt-[10px]">
        <InfoCircledIcon className="inline-flex" />{" "}
        <span className="text-[12px]">
          These documents and links can be configured to appear on individual
          plans or on all plans
        </span>
      </div>

      <div className="flex items-center gap-[10px] mt-[16px]">
        <Button
          className="rounded-[9999px] inline-flex items-center justify-center gap-[4px]"
          onClick={() => setPlanOpen(true)}
        >
          <FileTextIcon />
          <span>Add Plan Document(s)</span>
        </Button>
        <Button
          className="rounded-[9999px] text-gray-500 inline-flex items-center justify-center gap-[4px] border border-[#efefef] dark:border-[#1c1c1c] bg-transparent shadow-sm hover:scale-105 active:scale-95 ease-linear transition-all duration-100"
          onClick={() => setExternalOpen(true)}
        >
          <ExternalLinkIcon />
          <span>Add External Link</span>
        </Button>
      </div>
    </div>
  );
};

export default Documents;
