/**
 * Content for the public PlanTelligence marketing site.
 *
 * Every section renders from this file. Keeping the copy in one typed module
 * makes the claims easy to audit: if a capability is not shipped, it must not
 * appear here. In particular this file deliberately does not claim Synthesia or
 * HeyGen video generation, an answering chatbot, or completed Life Events
 * checklists.
 */

export type MarketingIconName =
  | "dashboard"
  | "plans"
  | "benefits"
  | "portal"
  | "palette"
  | "sparkles"
  | "document"
  | "video"
  | "team"
  | "book"
  | "layers"
  | "calendar"
  | "megaphone"
  | "qr"
  | "message"
  | "tasks"
  | "shield"
  | "mobile"
  | "bell"
  | "send"
  | "building"
  | "health"
  | "life"
  | "folder"
  | "userCheck"
  | "key"
  | "settings"
  | "checklist"
  | "mail"
  | "help"
  | "chart"
  | "image"
  | "type"
  | "pen";

export type VignetteVariant =
  | "portal"
  | "branding"
  | "benefits"
  | "communications"
  | "documents"
  | "team"
  | "dashboard";

export interface MarketingNavLink {
  label: string;
  href: string;
}

export interface MarketingPillar {
  icon: MarketingIconName;
  title: string;
  description: string;
}

export interface MarketingDeepDive {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  vignette: VignetteVariant;
  /** Puts the copy on the right and the vignette on the left at `lg`. */
  reverse?: boolean;
  /** Tints the band so adjacent deep dives never blur together. */
  tone?: "default" | "tinted";
}

export interface MarketingFeature {
  icon: MarketingIconName;
  title: string;
  description: string;
}

export interface MarketingStep {
  number: string;
  title: string;
  description: string;
}

export interface MarketingAudience {
  icon: MarketingIconName;
  title: string;
  description: string;
  bullets: string[];
}

export interface MarketingFaqItem {
  question: string;
  answer: string;
}

export const MARKETING_HERO = {
  eyebrow: "Benefits communication, end to end",
  title: "Every benefit, one clear story.",
  description:
    "PlanTelligence gives advisors and plan sponsors a branded participant portal, a structured benefits content library, and the communication tools to keep every plan current.",
  primaryCta: "Sign in",
  secondaryCta: "Explore the platform",
  supportingLine:
    "Built for retirement, group health, group life, and custom benefits.",
} as const;

export const MARKETING_HERO_CHIPS = [
  "Retirement",
  "Group Health",
  "Group Life",
  "Custom benefits",
] as const;

export const MARKETING_NAV_LINKS: MarketingNavLink[] = [
  { label: "Platform", href: "#features" },
  { label: "Participant portal", href: "#portal" },
  { label: "Communications", href: "#communications" },
  { label: "Team and access", href: "#team" },
  { label: "FAQ", href: "#faq" },
];

export const MARKETING_POSITIONING_POINTS: MarketingPillar[] = [
  {
    icon: "palette",
    title: "Branded at every step",
    description:
      "Logos, colors, typography, and portal imagery stay consistent from the plan workspace to the participant experience.",
  },
  {
    icon: "benefits",
    title: "Content stays usable",
    description:
      "Benefits, topics, documents, videos, and contacts live in one structured place instead of scattered files.",
  },
  {
    icon: "megaphone",
    title: "Communication in one place",
    description:
      "Meetings, webinars, flyers, notices, and QR codes are managed alongside the plan they belong to.",
  },
  {
    icon: "shield",
    title: "Access you control",
    description:
      "Role-based team access and plan-scoped collaborator permissions keep the right work with the right people.",
  },
];

export const MARKETING_PILLARS: MarketingPillar[] = [
  {
    icon: "plans",
    title: "Plan workspaces",
    description:
      "Create, brand, and manage every plan from a dashboard built for advisors and service teams.",
  },
  {
    icon: "benefits",
    title: "Benefits builder",
    description:
      "Turn plan details into structured hubs with topics, documents, videos, and the right contacts.",
  },
  {
    icon: "portal",
    title: "Participant portal",
    description:
      "Give employees a branded, mobile-ready place to find benefits, updates, and the people who can help.",
  },
  {
    icon: "megaphone",
    title: "Communications and team",
    description:
      "Coordinate meetings, webinars, flyers, notices, comments, and access in the same system.",
  },
];

export const MARKETING_DEEP_DIVES: MarketingDeepDive[] = [
  {
    id: "plans",
    eyebrow: "Plan setup",
    title: "From first conversation to a live plan.",
    description:
      "A guided workspace captures the details that shape the participant experience, then shows exactly what employees will see before anything is published.",
    bullets: [
      "Guided plan creation for company basics, key contacts, compliance documents, and disclosures.",
      "AI-assisted suggestions for brand colors, naming, and typography, applied only when the advisor accepts them.",
      "Logo, hero imagery, favicon, and typography themes applied across the portal.",
      "Live desktop and mobile previews before the plan goes live.",
    ],
    vignette: "branding",
  },
  {
    id: "benefits",
    eyebrow: "Benefits content",
    title: "Benefits content people can actually use.",
    description:
      "Each benefit category becomes a structured hub. Advisors decide what is featured, what lives in Quick Answers, and which resources sit behind each topic.",
    bullets: [
      "Dedicated hubs for Retirement, Group Health, Group Life, and a custom benefit.",
      "A reusable topic library with Featured cards, Quick Answers, and grouped accordions.",
      "Action hub panels that connect a topic to the right plan resources.",
      "Documents, videos, key contacts, and visibility controls in one place.",
    ],
    vignette: "benefits",
    reverse: true,
    tone: "tinted",
  },
  {
    id: "portal",
    eyebrow: "Participant experience",
    title: "A participant portal that feels like your brand.",
    description:
      "Employees get one clear destination for their benefits, announcements, resources, and the people who support the plan, all under the plan sponsor's identity.",
    bullets: [
      "A branded hub home with benefits, announcements, and team contacts.",
      "News and Events, Employee Resources, and Webinars and Replays.",
      "Contact forms routed to the right advisor or HR contact.",
      "An installable portal experience for participants who return often.",
      "Configurable disclaimers and disclosures on every participant surface.",
    ],
    vignette: "portal",
    tone: "tinted",
  },
  {
    id: "communications",
    eyebrow: "Communications",
    title: "Communication that keeps pace with the plan.",
    description:
      "Meetings, webinars, flyers, and portal updates are part of the plan workspace, not a separate stack of tools. Create the message once and publish it where participants already are.",
    bullets: [
      "A meetings calendar with scheduling and reminder support.",
      "Webinars and replays published directly into the portal.",
      "Meeting-based and topical flyers with QR codes that link to the portal.",
      "Portal notices, pop-ups, and news posts managed from one asset library.",
      "AI-assisted flyer copy with advisor review before anything is published.",
    ],
    vignette: "communications",
    reverse: true,
  },
  {
    id: "documents",
    eyebrow: "Documents",
    title: "One home for plan documents and assets.",
    description:
      "Keep the documents participants need alongside the benefit they belong to, with categories and naming that make the library navigable as plans grow.",
    bullets: [
      "A central document library with categories and search.",
      "Plan-level and benefit-level uploads.",
      "AI-suggested document names that keep libraries tidy.",
      "Secure uploads and signed access for participant-facing files.",
    ],
    vignette: "documents",
    tone: "tinted",
  },
  {
    id: "team",
    eyebrow: "Team and access",
    title: "Bring the whole service team into the work.",
    description:
      "Plan work rarely belongs to one person. PlanTelligence gives owners a clear way to invite teammates, scope collaborator access, and keep communication attached to the plan.",
    bullets: [
      "Owner, team member, and collaborator roles.",
      "Permission scopes by benefit category and access level.",
      "Invitations, seat management, and ownership transfer.",
      "Direct messages, comments, attachments, and task assignment.",
    ],
    vignette: "team",
  },
  {
    id: "dashboard",
    eyebrow: "Operations",
    title: "The operating view for every plan.",
    description:
      "The dashboard surfaces the work that needs attention across plans, so the team starts the day with the right tasks and meetings instead of hunting through workspaces.",
    bullets: [
      "Active plans, tasks, and meetings in one dashboard.",
      "Needs-attention signals for incomplete or stale plan content.",
      "Recent activity across plans and team members.",
      "A team overview with quick access to every workspace.",
    ],
    vignette: "dashboard",
    tone: "tinted",
  },
];

export const MARKETING_FEATURES: MarketingFeature[] = [
  {
    icon: "checklist",
    title: "Plan creation wizard",
    description:
      "A guided flow for company details, contacts, branding, compliance documents, and disclosures.",
  },
  {
    icon: "palette",
    title: "Brand and typography controls",
    description:
      "Plan-level logos, hero imagery, favicons, colors, and typography themes.",
  },
  {
    icon: "mobile",
    title: "Live portal preview",
    description:
      "Review the participant experience on desktop and mobile before publishing.",
  },
  {
    icon: "benefits",
    title: "Benefits hubs",
    description:
      "Separate, structured hubs for retirement, health, life, and custom benefits.",
  },
  {
    icon: "book",
    title: "Topic library and Quick Answers",
    description:
      "Featured cards, grouped questions, and a reusable library of participant topics.",
  },
  {
    icon: "layers",
    title: "Action hub panels",
    description:
      "Connect a topic to the plan resources and next steps that answer it.",
  },
  {
    icon: "document",
    title: "Documents and videos",
    description:
      "Attach plan documents and videos to the benefit category where participants need them.",
  },
  {
    icon: "team",
    title: "Key contacts",
    description:
      "Show participants the advisor, HR contact, or plan sponsor who can help.",
  },
  {
    icon: "megaphone",
    title: "News and Events",
    description:
      "Publish plan announcements and time-sensitive updates to the participant portal.",
  },
  {
    icon: "folder",
    title: "Employee Resources",
    description:
      "A dedicated plan surface for the resources employees ask about most.",
  },
  {
    icon: "video",
    title: "Webinars and replays",
    description:
      "Promote upcoming sessions and keep replays available inside the portal.",
  },
  {
    icon: "calendar",
    title: "Meetings and reminders",
    description:
      "Schedule participant meetings, review the calendar, and support reminders.",
  },
  {
    icon: "qr",
    title: "Flyers and QR codes",
    description:
      "Create meeting-based and topical flyers with portal QR codes.",
  },
  {
    icon: "bell",
    title: "Portal notices and pop-ups",
    description:
      "Publish top banners, pop-ups, and news posts without editing the portal by hand.",
  },
  {
    icon: "image",
    title: "Asset library",
    description:
      "Keep flyers, notices, and published marketing assets together by plan.",
  },
  {
    icon: "message",
    title: "Direct messages",
    description:
      "Keep plan-related conversations with teammates inside the workspace.",
  },
  {
    icon: "tasks",
    title: "Comments and tasks",
    description:
      "Discuss work in context, attach files, and assign follow-ups.",
  },
  {
    icon: "shield",
    title: "Roles and permissions",
    description:
      "Owner, team member, and collaborator access scoped by benefit category.",
  },
  {
    icon: "folder",
    title: "Document library",
    description:
      "A searchable library with categories, uploads, and plan-level organization.",
  },
  {
    icon: "sparkles",
    title: "AI content helpers",
    description:
      "Suggestions for brand colors, naming, typography, document names, and flyer copy.",
  },
  {
    icon: "mobile",
    title: "Installable portal",
    description:
      "Participants can add their benefits hub to their home screen on supported browsers.",
  },
  {
    icon: "checklist",
    title: "Disclosures and disclaimers",
    description:
      "Plan-level legal copy and participant disclosures, configurable per surface.",
  },
];

export const MARKETING_STEPS: MarketingStep[] = [
  {
    number: "01",
    title: "Create the plan",
    description:
      "Capture company basics, key contacts, branding, compliance documents, and disclosures in one guided flow.",
  },
  {
    number: "02",
    title: "Build the benefits story",
    description:
      "Organize each benefit into a hub with featured topics, Quick Answers, documents, videos, and the right contacts.",
  },
  {
    number: "03",
    title: "Publish and keep current",
    description:
      "Share the branded portal, announce updates, schedule meetings, and keep access with the right team.",
  },
];

export const MARKETING_AUDIENCES: MarketingAudience[] = [
  {
    icon: "building",
    title: "Advisors and consulting firms",
    description:
      "Deliver a consistent, branded participant experience across every plan without rebuilding it each time.",
    bullets: [
      "One place for plan setup and branding",
      "A reusable benefits and topic library",
      "Client-ready previews before publishing",
    ],
  },
  {
    icon: "userCheck",
    title: "TPAs and service teams",
    description:
      "Coordinate the documents, meetings, and participant questions that keep plans running.",
    bullets: [
      "Shared workspaces with scoped access",
      "Meeting scheduling and reminders",
      "Comments, tasks, and direct messages",
    ],
  },
  {
    icon: "health",
    title: "Plan sponsors and HR",
    description:
      "Give employees one clear place to find benefits, announcements, and the people who can help.",
    bullets: [
      "A branded benefits hub",
      "News, resources, and webinar replays",
      "Contact forms routed to the right team",
    ],
  },
];

export const MARKETING_FAQS: MarketingFaqItem[] = [
  {
    question: "What is PlanTelligence?",
    answer:
      "PlanTelligence is a benefits communication platform for the people who administer and support employer benefit plans. It combines plan workspaces, branded participant portals, a structured benefits content library, and communication tools in one application.",
  },
  {
    question: "Which benefit types are supported?",
    answer:
      "Retirement, group health, group life, and a custom benefit category are supported. Each one has its own hub, content, visibility controls, and participant-facing layout.",
  },
  {
    question: "Is the participant portal branded to each plan?",
    answer:
      "Yes. Advisors can set the plan's logo, hero imagery, favicon, brand colors, and typography theme, with desktop and mobile previews available before publishing.",
  },
  {
    question: "Can participants install the portal?",
    answer:
      "Yes. The portal is installable as a progressive web app on supported browsers, so participants can return to their benefits hub from their home screen.",
  },
  {
    question: "How do advisors keep plan content current?",
    answer:
      "Plan content is managed from the dashboard. Teams can update benefit hubs, publish news and events, add documents and videos, and post portal notices without rebuilding the portal.",
  },
  {
    question: "Can teams collaborate with different permissions?",
    answer:
      "Yes. Owners can invite team members and collaborators, scope collaborator access to specific benefit categories and permission levels, and manage seats and ownership transfer.",
  },
  {
    question: "Does PlanTelligence generate videos?",
    answer:
      "PlanTelligence lets advisors present plan videos inside benefit hubs and attach video content to a benefit category. It does not currently generate videos with Synthesia or HeyGen.",
  },
  {
    question: "Does the portal chatbot answer participant questions?",
    answer:
      "The participant portal includes a guided chat surface. Automated answer generation is not part of the current release.",
  },
  {
    question: "How is access controlled?",
    answer:
      "The dashboard uses authenticated roles and plan-scoped permissions. Collaborators only see the benefit categories and actions they have been granted, and participant-facing surfaces remain separate from internal workspaces.",
  },
  {
    question: "How do I get access?",
    answer:
      "Sign in at plantel.pro/signin. New users can create an account from the sign-in page, then complete onboarding to set up their organization and first plan.",
  },
];

export const MARKETING_FOOTER_TAGLINE =
  "Benefits communication, plan workspaces, and a participant portal in one platform.";
