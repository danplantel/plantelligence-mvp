"use client";

import { Fragment } from "react";

interface PortalDisclaimersProps {
  companyData?: {
    companyName?: string;
    disclaimers?: string;
    brandColor?: string;
  };
  brandColor?: string;
  onEdit?: () => void;
}

export function PortalDisclaimers({
  companyData,
  brandColor,
  onEdit,
}: PortalDisclaimersProps) {
  return (
    <section
      className="px-6 py-12 text-white relative"
      style={{ background: brandColor }}
    >
      <div className="mx-auto max-w-[1400px] w-full px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-dm-serif text-xl font-bold mb-4">
              Benefits Hub
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Your trusted partner in navigating employee benefits, retirement
              planning, and financial wellness.
            </p>
          </div>

          <div>
            <h4 className="font-dm-serif font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="#"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Benefits Overview
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Plan Materials
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Schedule Appointment
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Contact Support
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-dm-serif font-semibold mb-4">
              Contact Information
            </h4>
            <div className="text-sm text-gray-300 space-y-2">
              <p>Phone: (305) 555-1122</p>
              <p>Email: support@benefitshub.com</p>
              <p>Hours: Mon-Fri 8AM-6PM EST</p>
            </div>
          </div>
        </div>

        <div
          className={`border-t border-white/20 pt-8 relative group ${onEdit ? "cursor-pointer" : ""}`}
          onClick={onEdit}
        >
          {onEdit && (
            <>
              <div className="absolute inset-0 -m-4 rounded-lg transition-all group-hover:ring-2 group-hover:ring-blue-500/50 z-10" />
              <div className="absolute -top-2 -left-2 z-20 bg-blue-500 rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </div>
            </>
          )}
          <div className="space-y-6">
            {/* Dynamic Disclaimers Content */}
            <div className="space-y-4 text-white text-xs leading-relaxed">
              <strong>Disclosures:</strong>

              {companyData?.disclaimers ? (
                <div className="space-y-2">
                  {/* Render newlines explicitly (paragraphs on \n\n, line
                      breaks on \n) so breaks are preserved regardless of CSS. */}
                  {String(companyData.disclaimers)
                    .replace(/\r\n/g, "\n")
                    .replace(/\r/g, "\n")
                    .split("\n\n")
                    .map((paragraph, i) => (
                      <p key={i}>
                        {paragraph.split("\n").map((line, j) => (
                          <Fragment key={j}>
                            {j > 0 && <br />}
                            {line}
                          </Fragment>
                        ))}
                      </p>
                    ))}
                </div>
              ) : (
                <>
                  <p>
                    The LPL Financial registered representatives associated with
                    this website may discuss and/or transact business only with
                    residents of the states in which they are properly
                    registered or licensed. No offers may be made or accepted
                    from any resident of any other state.
                  </p>
                  <p>
                    Securities and financial planning services offered through
                    LPL Financial, a registered investment advisor, Member FINRA
                    / SIPC. Lighthouse Financial Advisors is a separate entity
                    from LPL Financial.
                  </p>
                  <p>
                    Sarah Johnson | Key West, FL | 123 Lighthouse Way, Key West,
                    FL 33040 | CA Insurance Lic. # 0F77158 | Phone: (305)
                    555-1122
                  </p>
                  <p>
                    Michael Frank | Key West, FL | 123 Lighthouse Way, Key West,
                    FL 33040 | CA Insurance Lic. # 0F37907 | Phone: (305)
                    555-3344
                  </p>
                  <p>
                    The content is developed from sources believed to be
                    providing accurate information. This material was created
                    for educational and informational purposes only and is not
                    intended as ERISA, tax, legal or investment advice. If you
                    are seeking investment advice specific to your needs, such
                    advice services must be obtained on your own separate from
                    this educational material. Some of this material was
                    developed and produced to provide information on a topic
                    that may be of interest. This is not affiliated with the
                    named representative, broker-dealer, state – or
                    SEC-registered investment advisory firm. The opinions
                    expressed and material provided are for general information
                    and should not be considered a solicitation for the purchase
                    or sale of any security.
                  </p>
                  <p>®Lighthouse Financial Advisors</p>
                </>
              )}
            </div>

            {/* Copyright */}
            <div className="text-center">
              <p className="text-xs text-gray-400">
                © 2024{" "}
                {companyData?.companyName || "Lighthouse Financial Advisors"}.
                All rights reserved. |
                <a href="#" className="hover:text-white ml-1">
                  Privacy Policy
                </a>{" "}
                |
                <a href="#" className="hover:text-white ml-1">
                  Terms of Service
                </a>{" "}
                | Powered by PlanTelligence™
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
