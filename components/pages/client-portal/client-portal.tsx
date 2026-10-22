"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  PortalHeader,
  PortalHero,
  PortalMission,
  PortalBenefits,
  PortalTeam,
  PortalDisclaimers,
  BenefitsTeam,
  WebinarsDashboard,
} from "./sections";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { KeyContact } from "@/types/new-client-wizard";
import { resolveFooterBackgroundColor } from "@/lib/portal-footer-color";

interface CompanyData {
  companyName?: string;
  companyLogo?: string;
  companyWebsite?: string;
  logoFileName?: string;
  brandColor?: string;
  secondaryColor?: string;
  /** Footer background color preference: { mode: "primary" | "secondary" | "custom", customColor?: string } */
  footerBackground?: { mode?: string; customColor?: string };
  backgroundImg?: string;
  backgroundImgName?: string;
  thumbnailImg?: string;
  thumbnailImgName?: string;
  missionHeadline?: string;
  missionBody?: string;
  appointmentLink?: string;
  disclaimers?: string;
  heroTitle?: string;
  heroDescription?: string;
  brandImages?: any; // For fallback to _meta.heroTitle and _meta.heroDescription
  // Banner Overlay Settings
  heroContainerOpacity?: number; // DEPRECATED: use heroContainerBackgroundOpacity and heroContainerBlockOpacity
  heroContainerBackgroundOpacity?: number;
  heroContainerBlockOpacity?: number;
  heroCompanyNameColor?: "yellow" | "default";
  heroContainerInverted?: boolean;
  heroBackgroundInverted?: boolean;
  heroInverted?: boolean; // Backward compatibility
  heroOverlayOpacity?: number;
  heroBackgroundOpacity?: number;
  heroUseGradient?: boolean;
  /** Desktop-specific background image position (percentage-based).
   *  Applied via object-position when a hero background image is present. */
  desktopHeroBackgroundPosition?: { x: number; y: number };
  /** Mobile-specific background image position (percentage-based).
   *  Applied via object-position when a hero background image is present. */
  mobileHeroBackgroundPosition?: { x: number; y: number };
}

interface ClientPortalData {
  companyData?: CompanyData;
  keyContacts?: KeyContact[];
  documents?: any[];
  employeePortalPreview?: any;
  categoryPortalVisibility?: Record<string, boolean> | null;
  /** Top-level from API; used for benefit completeness (category hero / banner). */
  secondaryBannerImg?: string;
}

interface ClientPortalProps {
  data?: ClientPortalData;
  isPreview?: boolean;
  className?: string;
  hideHeader?: boolean;
  hideFooter?: boolean;
  hideBenefits?: boolean;
  clientId?: string;
  onHeroTitleClick?: () => void;
  onHeroDescriptionClick?: () => void;
  onMissionHeadlineClick?: () => void;
  onMissionBodyClick?: () => void;
  showEditIndicators?: boolean;
}

/** Life events that have a step-by-step benefits checklist behind them. */
const LIFE_EVENT_CHECKLISTS = [
  "Having a baby",
  "Getting married",
  "Moving",
  "Leaving the company",
  "Approaching Retirement",
  "Losing a Loved One",
  "Divorce",
  "Going on Leave",
] as const;

interface SomethingChangedProps {
  brandColor?: string;
  secondaryColor?: string;
}

/**
 * "Something Changed? Start Here." — the life-event entry point shown directly
 * beneath "Your Benefits at a Glance".
 *
 * Each row is a button so the checklists can be wired to their pages later;
 * for now they are presentational.
 */
function SomethingChanged({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
}: SomethingChangedProps) {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-20 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2
            className="font-dm-serif text-3xl leading-tight sm:text-4xl lg:text-[40px]"
            style={{ color: brandColor }}
          >
            Something Changed? Start Here.
          </h2>
          <p className="mt-2 font-red-hat text-base text-gray-600 sm:text-lg">
            Step-by-step checklists across all your benefits.
          </p>
        </div>

        {/* Two rows of four from `lg` up; two columns on tablets, one on phones. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LIFE_EVENT_CHECKLISTS.map((label) => (
            <button
              key={label}
              type="button"
              className="group flex min-h-[72px] w-full items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md"
              style={{
                backgroundColor: secondaryColor,
                borderColor: secondaryColor,
              }}
            >
              <span className="font-red-hat text-sm font-medium text-white">
                {label}
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-white transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClientPortal({
  data,
  isPreview = false,
  className = "",
  hideHeader = false,
  hideFooter = false,
  hideBenefits = false,
  clientId,
  onHeroTitleClick,
  onHeroDescriptionClick,
  onMissionHeadlineClick,
  onMissionBodyClick,
  showEditIndicators = true,
}: ClientPortalProps) {
  const companyData = data?.companyData;
  const keyContacts = data?.keyContacts || [];

  // Normalize hero background: use backgroundImg, fallback to header
  const heroBackgroundImg =
    companyData?.backgroundImg ||
    (companyData as any)?.brandImages?.header?.url ||
    "";

  // Dynamic brand colors
  const brandColor = companyData?.brandColor || "#1F3A60";
  const secondaryColor = companyData?.secondaryColor || "#6B7280";

  // Resolve footer background color from the plan's footerBackground preference,
  // using the shared rule the portal layout applies, so a preview and the live
  // portal paint the same colour.
  const footerBgColor = resolveFooterBackgroundColor(
    companyData?.footerBackground,
    brandColor,
    secondaryColor,
  );

  const fadeLeft = {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0 },
  };

  const fadeRight = {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  };

  const portalContent = (
    <div
      className={`relative bg-white min-h-screen overflow-hidden ${className}`}
      style={{ zIndex: 1 }}
    >
      {!hideHeader && (
        <PortalHeader
          companyData={companyData}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          categoryPortalVisibility={data?.categoryPortalVisibility}
          benefits={data?.employeePortalPreview?.benefits}
        />
      )}

      <div data-preview-field="banner">
        <PortalHero
          companyData={{
            ...companyData,
            backgroundImg: heroBackgroundImg,
          }}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          heroTitle={
            companyData?.heroTitle ||
            (companyData as any)?.brandImages?._meta?.heroTitle
          }
          heroDescription={
            companyData?.heroDescription ||
            (companyData as any)?.brandImages?._meta?.heroDescription
          }
          backgroundOpacity={companyData?.heroBackgroundOpacity ?? 1.0}
          containerBlockOpacity={
            companyData?.heroContainerBlockOpacity ??
            companyData?.heroContainerOpacity ??
            0.67
          }
          containerInverted={companyData?.heroContainerInverted ?? false}
          backgroundInverted={companyData?.heroBackgroundInverted ?? false}
          useGradient={companyData?.heroUseGradient ?? false}
          desktopHeroBackgroundPosition={
            companyData?.desktopHeroBackgroundPosition
          }
          mobileHeroBackgroundPosition={
            companyData?.mobileHeroBackgroundPosition
          }
          onHeroTitleClick={onHeroTitleClick}
          onHeroDescriptionClick={onHeroDescriptionClick}
          showEditIndicators={showEditIndicators}
        />
      </div>

      <div data-preview-field="mission">
        <PortalMission
          company={companyData}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          onMissionHeadlineClick={onMissionHeadlineClick}
          onMissionBodyClick={onMissionBodyClick}
          showEditIndicators={showEditIndicators}
        />
      </div>

      {!hideBenefits && (
        <PortalBenefits
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          keyContacts={keyContacts}
          benefits={
            data?.employeePortalPreview?.benefits ??
            data?.employeePortalPreview?.previewData?.benefits
          }
          documents={data?.documents}
          employeePortalPreview={data?.employeePortalPreview}
          categoryPortalVisibility={data?.categoryPortalVisibility}
          baselineBackgroundColor={
            (data?.keyContacts as any)?.cardBackgroundColor
          }
          completenessClientData={{
            companyLogo: companyData?.companyLogo,
            missionBody: companyData?.missionBody,
            heroDescription: companyData?.heroDescription,
            backgroundImg: heroBackgroundImg,
            secondaryBannerImg: data?.secondaryBannerImg,
            keyContacts,
            documents: data?.documents,
            employeePortalPreview: data?.employeePortalPreview,
          }}
        />
      )}

      <SomethingChanged
        brandColor={brandColor}
        secondaryColor={secondaryColor}
      />

      {/* <motion.div
        variants={fadeRight}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
      >
        <PortalTeam
          keyContacts={keyContacts.map((contact) => ({
            ...contact,
            companyLogo: companyData?.companyLogo,
          }))}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
        />
      </motion.div> */}

      {!hideFooter && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
        >
          <PortalDisclaimers
            companyData={companyData}
            brandColor={footerBgColor}
          />
        </motion.div>
      )}
    </div>
  );

  // Preview wrapper
  if (isPreview) {
    return (
      <Card className="shadow-none">
        <CardContent className="p-6">
          {portalContent}
          <div className="bg-blue-50 mt-4 p-4 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> This is a preview of how your client&apos;s
              portal will appear. The actual portal will be fully functional
              with dynamic content and navigation.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return portalContent;
}
