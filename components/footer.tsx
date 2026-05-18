interface FooterProps {
  brandColor?: string;
  disclosuresText?: string | null;
}

export function Footer({
  brandColor = "#1F3A60",
  disclosuresText,
}: FooterProps) {
  return (
    <footer
      className="text-white py-12 font-red-hat"
      style={{ background: brandColor }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

        <div className="border-t border-gray-700 pt-8">
          <div className="space-y-6">
            {/* Disclosures */}
            <div className="text-xs text-gray-300 leading-relaxed space-y-4">
              <p>
                <strong>Disclosures:</strong>
              </p>
              {disclosuresText ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: disclosuresText
                      .split("\n\n")
                      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
                      .join(""),
                  }}
                />
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
                © 2024 Lighthouse Financial Advisors. All rights reserved. |
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
    </footer>
  );
}
