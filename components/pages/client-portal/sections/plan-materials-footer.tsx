"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PlanMaterialsFooterProps {
  hideBackToHome?: boolean;
}

export function PlanMaterialsFooter({
  hideBackToHome = false,
}: PlanMaterialsFooterProps) {
  return (
    <>
      {!hideBackToHome && (
        <div className="flex justify-center py-[30px] lg:py-[80px]">
          <Link href="/dashboard">
            <Button
              className="flex items-center rounded-[4px] bg-[#cccccc] uppercase text-sm font-semibold"
              variant="secondary"
            >
              &lt;&lt; Back to Home
            </Button>
          </Link>
        </div>
      )}
      <div className="px-[16px] shadow-[0px_-5px_10px_0px_rgba(0,0,0,0.09)]">
        <div className="mx-auto max-w-[1260px] space-y-[16px] py-[40px] text-[14px] font-light lg:py-[60px]">
          <p className="font-red-hat">Disclosures:</p>
          <p className="font-red-hat">
            The LPL Financial registered representatives associated with this
            website may discuss and/or transact business only with residents of
            the states in which they are properly registered or licensed. No
            offers may be made or accepted from any resident of any other state.
          </p>
          <p className="font-red-hat">
            Securities and financial planning services offered through LPL
            Financial, a registered investment advisor, Member FINRA / SIPC.
            Waypoint Financial Advisors is a separate entity from LPL Financial.
          </p>
          <p className="font-red-hat">
            Ty Rogers | Key West, FL | 49 Bay Drive, Key West, FL 33040 | CA
            Insurance Lic. # 0F77158.
          </p>
          <p className="font-red-hat">
            Jennifer D’ Amico | Key West, FL | 49 Bay Drive, Key West, FL 33040
            | CA Insurance Lic. # 0F37907.
          </p>
          <p className="font-red-hat">
            The content is developed from sources believed to be providing
            accurate information. This material was created for educational and
            informational purposes only and is not intended as ERISA, tax, legal
            or investment advice. If you are seeking investment advice specific
            to your needs, such advice services must be obtained on your own
            separate from this educational material. Some of this material was
            developed and produced to provide information on a topic that may be
            of interest. This is not affiliated with the named representative,
            broker-dealer, state – or SEC-registered investment advisory firm.
            The opinions expressed and material provided are for general
            information, and should not be considered a solicitation for the
            purchase or sale of any security.
          </p>
          <p className="font-red-hat">®Waypoint Financial Advisors</p>
          <p className="font-red-hat">
            Powered by:
            <br />
            PLANtelligence | Branded Benefits Technology (BBT)
          </p>
        </div>
      </div>
      <div className="bg-[#28334e] px-[16px]">
        <div className="mx-auto max-w-[1260px] space-y-[12px] py-[16px] text-[14px] font-light">
          <p className="text-white font-red-hat">
            © 2025 Waypoint Financial Advisors. All rights reserved.
          </p>
        </div>
      </div>
    </>
  );
}
