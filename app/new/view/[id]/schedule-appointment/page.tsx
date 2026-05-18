"use client";

import { PlanMaterialsFooter } from "@/components/pages/client-portal/sections/plan-materials-footer";
import { useClientPortal } from "@/contexts/client-portal-context";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { PageFade } from "@/components/animations/page-fade";

export default function ScheduleAppointmentPage() {
  const { clientData } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#A38D5D";

  const appointmentUrl = useMemo(() => {
    if (clientData?.appointmentLink?.trim()) {
      return clientData.appointmentLink;
    }
    return "https://go.oncehub.com/WFAParticipantInquiry";
  }, [clientData?.appointmentLink]);

  const companyName = clientData?.companyName || "Waypoint Financial Advisors";

  const handleClick = () => {
    window.open(appointmentUrl, "_blank");
  };

  return (
    <PageFade className="min-h-screen bg-[#f2f2f2] px-4 py-16">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white px-6 py-12 text-center shadow-xl md:px-16">
        <p
          className="text-sm uppercase tracking-[0.2em]"
          style={{ color: secondaryColor }}
        >
          Schedule Appointment
        </p>
        <h1
          className="dm-serif mt-4 text-3xl font-semibold md:text-4xl"
          style={{ color: brandColor }}
        >
          Meet with the {companyName} advisory team
        </h1>
        <p className="mt-6 text-base text-gray-600 md:text-lg">
          Choose a time that works best for you to review enrollment steps,
          discuss your retirement goals, or walk through your personalized
          financial plan. Sessions are hosted virtually by Waypoint Financial
          Advisors.
        </p>
        <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-center">
          <div
            className="rounded-xl border border-dashed px-6 py-4 text-left md:w-1/2"
            style={{ borderColor: secondaryColor }}
          >
            <p className="text-sm font-semibold" style={{ color: brandColor }}>
              What to expect
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
              <li>15-minute one-on-one Zoom or phone consultation</li>
              <li>Guidance on plan enrollment and rollovers</li>
              <li>Help aligning investment options with personal goals</li>
            </ul>
          </div>
          <div className="rounded-xl border border-gray-100 px-6 py-4 text-left shadow-sm md:w-1/2">
            <p className="text-sm font-semibold" style={{ color: brandColor }}>
              Need help right away?
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Email us anytime at{" "}
              <a
                href={`mailto:${
                  clientData?.keyContacts?.[0]?.email || "info@waypointfas.com"
                }`}
                className="font-semibold"
                style={{ color: brandColor }}
              >
                {clientData?.keyContacts?.[0]?.email || "info@waypointfas.com"}
              </a>{" "}
              or call{" "}
              <span className="font-semibold" style={{ color: brandColor }}>
                {clientData?.keyContacts?.[0]?.phone || "(888) 555-5555"}
              </span>
              .
            </p>
          </div>
        </div>
        <Button
          className="mt-10 h-12 w-full max-w-xs rounded-full text-base font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: brandColor }}
          onClick={handleClick}
        >
          Book on our calendar
        </Button>
      </div>

      <div className="mt-12">
        <PlanMaterialsFooter hideBackToHome />
      </div>
    </PageFade>
  );
}
