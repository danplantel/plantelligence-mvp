import type { ReactNode } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Menu,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import type { VignetteVariant } from "@/config/marketing";

/**
 * Code-drawn product previews.
 *
 * These are deliberately not screenshots: they stay sharp at every viewport,
 * carry no participant or client data, and can never drift out of date the way
 * a captured image does. Each frame is decorative (the surrounding section
 * carries the accessible description), so it is hidden from assistive tech.
 */
function VignetteFrame({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="relative" aria-hidden="true" title={label}>
      <div className="absolute -inset-5 rounded-[2rem] bg-[radial-gradient(ellipse_at_top_left,rgba(35,145,156,0.18),transparent_62%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-[#E2DCCF] bg-white shadow-[0_30px_70px_-42px_rgba(20,36,58,0.65)]">
        <div className="flex items-center gap-1.5 border-b border-[#EDE7DC] bg-[#FBF9F6] px-4 py-3">
          <span className="size-2 rounded-full bg-[#E2DCCF]" />
          <span className="size-2 rounded-full bg-[#E2DCCF]" />
          <span className="size-2 rounded-full bg-[#E2DCCF]" />
          <span className="ml-3 rounded-md border border-[#EDE7DC] bg-white px-2 py-1 text-[9px] font-medium text-[#7A8595]">
            product preview · sample data
          </span>
        </div>
        <div className="bg-[#FBF9F6] p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}

function PortalBenefitCard({
  icon,
  title,
  copy,
  tone,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  tone: string;
}) {
  return (
    <div className={`rounded-lg border border-[#E7E1D8] p-2.5 ${tone}`}>
      <span className="grid size-6 place-items-center rounded-md bg-white/80 text-[#1B7C86]">
        {icon}
      </span>
      <p className="mt-2 text-[9px] font-semibold text-[#14243A]">{title}</p>
      <p className="mt-0.5 text-[8px] leading-snug text-[#6B7787]">{copy}</p>
    </div>
  );
}

export function PortalHeroVignette() {
  return (
    <VignetteFrame label="Preview of a branded participant benefits hub">
      <div className="overflow-hidden rounded-xl border border-[#E7E1D8] bg-[#FBF9F6]">
        <div className="flex items-center justify-between border-b border-[#E7E1D8] bg-white px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[#1F3A60] text-[8px] font-bold text-white">
              PS
            </span>
            <span className="text-[10px] font-semibold text-[#1F3A60]">
              Your Plan Sponsor
            </span>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            {["Benefits", "News", "Resources", "Team"].map((item, index) => (
              <span
                key={item}
                className={`rounded-full px-2 py-1 text-[8px] ${
                  index === 0 ? "bg-[#1F3A60] text-white" : "text-[#526072]"
                }`}
              >
                {item}
              </span>
            ))}
          </div>
          <span className="grid size-6 place-items-center rounded-full bg-[#EAF5F6] text-[#1B7C86]">
            <Bell className="size-3" />
          </span>
        </div>

        <div className="m-2.5 overflow-hidden rounded-xl bg-gradient-to-br from-[#1F3A60] via-[#1F3A60] to-[#23919C] p-4 text-white sm:p-5">
          <span className="inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[8px] uppercase tracking-[0.16em]">
            Your benefits hub
          </span>
          <p className="mt-2 max-w-[22rem] font-dm-serif text-xl leading-[1.05] sm:text-2xl">
            Everything you need, in one place.
          </p>
          <p className="mt-2 max-w-[24rem] text-[10px] leading-relaxed text-white/75">
            Plan details, documents, announcements, and the people who can
            help.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-[#1F3A60]">
              Explore benefits
            </span>
            <span className="rounded-full border border-white/35 px-2.5 py-1 text-[9px] text-white/90">
              Meet your team
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-2.5 pb-2.5">
          <PortalBenefitCard
            icon={<BookOpen className="size-3" />}
            title="Retirement"
            copy="Plan and invest"
            tone="bg-[#EAF5F6]"
          />
          <PortalBenefitCard
            icon={<HeartPulse className="size-3" />}
            title="Group Health"
            copy="Coverage and care"
            tone="bg-[#F7F0E6]"
          />
          <PortalBenefitCard
            icon={<ShieldCheck className="size-3" />}
            title="Group Life"
            copy="Protection details"
            tone="bg-[#EEF0F6]"
          />
        </div>

        <div className="grid gap-2 px-2.5 pb-2.5 sm:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-[#E7E1D8] bg-white p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-semibold text-[#14243A]">
                Quick answers
              </p>
              <span className="text-[8px] text-[#1B7C86]">View all</span>
            </div>
            {["How do I enroll?", "When can I change my contribution?"].map(
              (question) => (
                <div
                  key={question}
                  className="mt-1.5 flex items-center justify-between rounded-md bg-[#FBF9F6] px-2 py-1.5"
                >
                  <span className="text-[8px] text-[#3E4C5E]">{question}</span>
                  <ChevronDown className="size-2.5 text-[#8A94A3]" />
                </div>
              ),
            )}
          </div>
          <div className="rounded-lg border border-[#D6E8EA] bg-[#EAF5F6] p-2.5">
            <p className="text-[9px] font-semibold text-[#14243A]">
              Upcoming webinar
            </p>
            <p className="mt-1 text-[8px] leading-snug text-[#526072]">
              Planning for the next chapter
            </p>
            <span className="mt-2 inline-flex rounded-full bg-[#1F3A60] px-2 py-0.5 text-[8px] font-medium text-white">
              View details
            </span>
          </div>
        </div>
      </div>
    </VignetteFrame>
  );
}

export function BrandingVignette() {
  return (
    <VignetteFrame label="Preview of plan branding and typography controls">
      <div className="grid gap-3 sm:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-xl border border-[#E7E1D8] bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold text-[#14243A]">
              Create plan
            </p>
            <span className="rounded-full bg-[#EAF5F6] px-2 py-0.5 text-[8px] text-[#1B7C86]">
              Step 3 of 5
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {[
              ["Company basics", true],
              ["Brand and typography", true],
              ["Key contacts", true],
              ["Portal preview", false],
            ].map(([label, complete]) => (
              <div
                key={label as string}
                className="flex items-center gap-2 rounded-md bg-[#FBF9F6] px-2 py-1.5"
              >
                <span
                  className={`grid size-4 place-items-center rounded-full text-[8px] ${
                    complete
                      ? "bg-[#23919C] text-white"
                      : "border border-[#D8D1C4] text-[#8A94A3]"
                  }`}
                >
                  {complete ? <Check className="size-2.5" /> : null}
                </span>
                <span className="text-[8px] text-[#3E4C5E]">
                  {label as string}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#E7E1D8] bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold text-[#14243A]">
              Plan brand
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F0E6] px-2 py-0.5 text-[8px] text-[#8A6A3B]">
              <Sparkles className="size-2.5" /> AI suggested
            </span>
          </div>
          <div className="mt-3 rounded-lg border border-dashed border-[#D8D1C4] bg-[#FBF9F6] p-3 text-center">
            <span className="mx-auto grid size-9 place-items-center rounded-lg bg-[#1F3A60] text-[8px] font-bold text-white">
              LOGO
            </span>
            <p className="mt-1.5 text-[8px] text-[#8A94A3]">
              Plan sponsor mark
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {["#1F3A60", "#23919C", "#EAF5F6", "#F7F0E6"].map((color) => (
              <span
                key={color}
                className="size-5 rounded-full border border-black/5"
                style={{ backgroundColor: color }}
              />
            ))}
            <span className="ml-1 text-[8px] text-[#6B7787]">
              Brand colors
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-[#FBF9F6] p-2">
              <p className="font-dm-serif text-lg leading-none text-[#1F3A60]">
                Aa
              </p>
              <p className="mt-1 text-[8px] text-[#6B7787]">Headline</p>
            </div>
            <div className="rounded-md bg-[#FBF9F6] p-2">
              <p className="font-red-hat text-sm leading-none text-[#1F3A60]">
                Aa
              </p>
              <p className="mt-1 text-[8px] text-[#6B7787]">Body</p>
            </div>
          </div>
        </div>
      </div>
    </VignetteFrame>
  );
}

export function BenefitsVignette() {
  return (
    <VignetteFrame label="Preview of a benefits hub with featured topics and Quick Answers">
      <div className="rounded-xl border border-[#E7E1D8] bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-semibold text-[#14243A]">
              Retirement hub
            </p>
            <p className="text-[8px] text-[#6B7787]">
              Featured topics and quick answers
            </p>
          </div>
          <div className="flex gap-1">
            {["Plan", "Topics", "Documents"].map((tab, index) => (
              <span
                key={tab}
                className={`rounded-full px-2 py-1 text-[8px] ${
                  index === 1
                    ? "bg-[#1F3A60] text-white"
                    : "bg-[#FBF9F6] text-[#6B7787]"
                }`}
              >
                {tab}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Enrollment", "How to join the plan"],
            ["Contributions", "Match and vesting"],
            ["Investments", "Fund options"],
          ].map(([title, copy]) => (
            <div
              key={title}
              className="rounded-lg border border-[#E7E1D8] bg-[#FBF9F6] p-2"
            >
              <span className="grid size-5 place-items-center rounded-md bg-[#EAF5F6] text-[#1B7C86]">
                <BookOpen className="size-2.5" />
              </span>
              <p className="mt-1.5 text-[8px] font-semibold text-[#14243A]">
                {title}
              </p>
              <p className="mt-0.5 text-[7px] leading-snug text-[#6B7787]">
                {copy}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-[#E7E1D8]">
          <div className="flex items-center justify-between border-b border-[#EDE7DC] px-2.5 py-2">
            <p className="text-[8px] font-semibold text-[#14243A]">
              Quick answers
            </p>
            <span className="text-[7px] text-[#1B7C86]">12 topics</span>
          </div>
          {[
            "How much should I contribute?",
            "What is the employer match?",
            "When am I vested?",
          ].map((question, index) => (
            <div
              key={question}
              className={`flex items-center justify-between px-2.5 py-2 ${
                index > 0 ? "border-t border-[#F0ECE4]" : ""
              }`}
            >
              <span className="text-[8px] text-[#3E4C5E]">{question}</span>
              <ChevronDown className="size-2.5 text-[#8A94A3]" />
            </div>
          ))}
        </div>
      </div>
    </VignetteFrame>
  );
}

export function CommunicationsVignette() {
  return (
    <VignetteFrame label="Preview of the meetings calendar, flyer, and portal notice tools">
      <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-[#E7E1D8] bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold text-[#14243A]">
              Meetings
            </p>
            <span className="rounded-full bg-[#EAF5F6] px-2 py-0.5 text-[8px] text-[#1B7C86]">
              This week
            </span>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span
                key={`${day}-${index}`}
                className="text-center text-[7px] text-[#8A94A3]"
              >
                {day}
              </span>
            ))}
            {Array.from({ length: 21 }).map((_, index) => (
              <span
                key={index}
                className={`grid aspect-square place-items-center rounded text-[7px] ${
                  index === 9 || index === 15
                    ? "bg-[#1F3A60] font-semibold text-white"
                    : "bg-[#FBF9F6] text-[#6B7787]"
                }`}
              >
                {index + 1}
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[#F7F0E6] px-2 py-1.5">
            <CalendarDays className="size-2.5 text-[#8A6A3B]" />
            <span className="text-[7px] text-[#6B5A3E]">
              Reminder scheduled
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#E7E1D8] bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold text-[#14243A]">
              Meeting flyer
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F0E6] px-2 py-0.5 text-[8px] text-[#8A6A3B]">
              <Sparkles className="size-2.5" /> Copy assist
            </span>
          </div>
          <div className="mt-2 rounded-lg bg-gradient-to-br from-[#1F3A60] to-[#23919C] p-3 text-white">
            <p className="text-[7px] uppercase tracking-[0.16em] text-white/70">
              You are invited
            </p>
            <p className="mt-1 font-dm-serif text-base leading-tight">
              Your benefits, explained.
            </p>
            <p className="mt-1 text-[7px] text-white/75">
              Join a live walkthrough of your plan.
            </p>
            <div className="mt-2 inline-flex rounded-full bg-white px-2 py-0.5 text-[7px] font-semibold text-[#1F3A60]">
              Save your spot
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#E7E1D8] p-2">
            <span className="grid size-8 place-items-center rounded-md bg-[#FBF9F6] text-[#1F3A60]">
              <QrCode className="size-5" />
            </span>
            <div>
              <p className="text-[8px] font-semibold text-[#14243A]">
                Portal QR code
              </p>
              <p className="text-[7px] text-[#6B7787]">
                Scan to open the benefits hub
              </p>
            </div>
          </div>
        </div>
      </div>
    </VignetteFrame>
  );
}

export function DocumentsVignette() {
  return (
    <VignetteFrame label="Preview of the plan document library">
      <div className="rounded-xl border border-[#E7E1D8] bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-[#E7E1D8] bg-[#FBF9F6] px-2 py-1.5">
            <Search className="size-3 text-[#8A94A3]" />
            <span className="text-[8px] text-[#8A94A3]">
              Search documents
            </span>
          </div>
          <span className="rounded-full bg-[#1F3A60] px-2 py-1 text-[8px] font-medium text-white">
            Upload
          </span>
        </div>
        <div className="mt-2 flex gap-1">
          {["All", "Compliance", "Plan notices", "Forms"].map((chip, index) => (
            <span
              key={chip}
              className={`rounded-full px-2 py-0.5 text-[7px] ${
                index === 0
                  ? "bg-[#EAF5F6] text-[#1B7C86]"
                  : "bg-[#FBF9F6] text-[#6B7787]"
              }`}
            >
              {chip}
            </span>
          ))}
        </div>
        <div className="mt-2 divide-y divide-[#F0ECE4] rounded-lg border border-[#E7E1D8]">
          {[
            ["Summary Plan Description", "Compliance", "PDF"],
            ["2026 Enrollment Guide", "Plan notices", "PDF"],
            ["Beneficiary Form", "Forms", "PDF"],
          ].map(([name, category, type]) => (
            <div key={name} className="flex items-center gap-2 px-2.5 py-2">
              <span className="grid size-6 place-items-center rounded-md bg-[#EAF5F6] text-[#1B7C86]">
                <FileText className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[8px] font-medium text-[#14243A]">
                  {name}
                </p>
                <p className="text-[7px] text-[#6B7787]">{category}</p>
              </div>
              <span className="rounded bg-[#F7F0E6] px-1.5 py-0.5 text-[7px] font-medium text-[#8A6A3B]">
                {type}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[#F7F0E6] px-2 py-1.5">
          <Sparkles className="size-2.5 text-[#8A6A3B]" />
          <span className="text-[7px] text-[#6B5A3E]">
            AI-suggested name: 2026 Summary Annual Report
          </span>
        </div>
      </div>
    </VignetteFrame>
  );
}

export function TeamVignette() {
  return (
    <VignetteFrame label="Preview of team roles and collaborator permissions">
      <div className="rounded-xl border border-[#E7E1D8] bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-semibold text-[#14243A]">
              Plan team
            </p>
            <p className="text-[8px] text-[#6B7787]">
              Roles and scoped access
            </p>
          </div>
          <span className="rounded-full bg-[#1F3A60] px-2 py-1 text-[8px] font-medium text-white">
            Invite
          </span>
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            ["Owner", "Full access", "bg-[#EAF5F6] text-[#1B7C86]"],
            [
              "Team member",
              "Plans and communications",
              "bg-[#EEF0F6] text-[#4E5B7A]",
            ],
            [
              "Collaborator",
              "Retirement hub only",
              "bg-[#F7F0E6] text-[#8A6A3B]",
            ],
          ].map(([role, scope, tone]) => (
            <div
              key={role}
              className="flex items-center gap-2 rounded-lg border border-[#E7E1D8] px-2 py-2"
            >
              <span className="grid size-6 place-items-center rounded-full bg-[#FBF9F6] text-[#1F3A60]">
                <Users className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-semibold text-[#14243A]">
                  {role}
                </p>
                <p className="text-[7px] text-[#6B7787]">{scope}</p>
              </div>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[7px] font-medium ${tone}`}
              >
                {role === "Collaborator" ? "Scoped" : "Active"}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1 rounded-lg bg-[#FBF9F6] p-2 text-[7px] text-[#6B7787]">
          <span className="font-semibold text-[#3E4C5E]">Permission</span>
          <span>View</span>
          <span>Edit</span>
          <span>Benefit content</span>
          <span className="text-[#1B7C86]">✓</span>
          <span className="text-[#1B7C86]">✓</span>
          <span>Team settings</span>
          <span>—</span>
          <span>—</span>
        </div>
      </div>
    </VignetteFrame>
  );
}

export function DashboardVignette() {
  return (
    <VignetteFrame label="Preview of the advisor dashboard with tasks and meetings">
      <div className="rounded-xl border border-[#E7E1D8] bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-semibold text-[#14243A]">
              Dashboard
            </p>
            <p className="text-[8px] text-[#6B7787]">Sample workspace</p>
          </div>
          <span className="grid size-6 place-items-center rounded-md bg-[#FBF9F6] text-[#1F3A60]">
            <Menu className="size-3" />
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[
            ["Active plans", "6", "bg-[#EAF5F6]"],
            ["Tasks due", "4", "bg-[#F7F0E6]"],
            ["Meetings", "2", "bg-[#EEF0F6]"],
          ].map(([label, value, tone]) => (
            <div key={label} className={`rounded-lg p-2 ${tone}`}>
              <p className="text-[7px] text-[#6B7787]">{label}</p>
              <p className="mt-0.5 text-base font-semibold leading-none text-[#14243A]">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-[#E7E1D8] p-2">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-semibold text-[#14243A]">
                Tasks
              </p>
              <span className="text-[7px] text-[#1B7C86]">View all</span>
            </div>
            {[
              ["Review enrollment guide", true],
              ["Publish quarter update", false],
              ["Confirm meeting notes", false],
            ].map(([task, complete]) => (
              <div
                key={task as string}
                className="mt-1 flex items-center gap-1.5"
              >
                <span
                  className={`grid size-3 place-items-center rounded-full ${
                    complete
                      ? "bg-[#23919C] text-white"
                      : "border border-[#D8D1C4]"
                  }`}
                >
                  {complete ? <Check className="size-2" /> : null}
                </span>
                <span
                  className={`text-[7px] ${
                    complete
                      ? "text-[#8A94A3] line-through"
                      : "text-[#3E4C5E]"
                  }`}
                >
                  {task as string}
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-[#E7E1D8] p-2">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-semibold text-[#14243A]">
                This week
              </p>
              <CalendarDays className="size-2.5 text-[#8A94A3]" />
            </div>
            {[
              ["Tue", "Plan review"],
              ["Thu", "Participant session"],
            ].map(([day, title]) => (
              <div key={day} className="mt-1 flex items-center gap-1.5">
                <span className="rounded bg-[#FBF9F6] px-1 py-0.5 text-[7px] font-medium text-[#6B7787]">
                  {day}
                </span>
                <span className="truncate text-[7px] text-[#3E4C5E]">
                  {title}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[#FBF9F6] px-2 py-1.5">
          <LayoutDashboard className="size-2.5 text-[#1B7C86]" />
          <span className="text-[7px] text-[#6B7787]">
            Needs attention: 1 plan has an incomplete benefit hub
          </span>
        </div>
      </div>
    </VignetteFrame>
  );
}

export function ProductVignette({ variant }: { variant: VignetteVariant }) {
  switch (variant) {
    case "branding":
      return <BrandingVignette />;
    case "benefits":
      return <BenefitsVignette />;
    case "communications":
      return <CommunicationsVignette />;
    case "documents":
      return <DocumentsVignette />;
    case "team":
      return <TeamVignette />;
    case "dashboard":
      return <DashboardVignette />;
    case "portal":
    default:
      return <PortalHeroVignette />;
  }
}
