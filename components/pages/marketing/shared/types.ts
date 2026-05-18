import { UploadFileResponse } from "uploadthing/client";

export type BulletPoint = {
  id: string;
  title: string;
  body: string;
};

export type FlyerFields = {
  planId: string;
  planName: string;
  language: "English" | "Spanish";
  heroHeadline: string;
  heroSubheadline: string;
  sponsorName: string;
  sponsorTagline: string;
  introHeadline: string;
  introParagraph: string;
  bulletPoints: BulletPoint[];
  contactParagraph: string;
  qrHeadline: string;
  qrSubheadline: string;
  qrCta: string;
  qrUrl: string;
  advisorName: string;
  advisorDescription: string;
  disclaimer: string;
  advisoryDisclosure: string;
  heroBanner: UploadFileResponse[];
  sponsorLogo: UploadFileResponse[];
  advisorLogo: UploadFileResponse[];
};

export type GroupSession = {
  id: string;
  date: string;
  time: string;
  language: "English" | "Spanish";
};

export type OneOnOneConsultation = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type MeetingFlyerFields = {
  planId: string;
  planName: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroSubheadline2: string;
  mainCallToAction: string;
  groupSessions: GroupSession[];
  oneOnOneConsultations: OneOnOneConsultation[];
  locationText: string;
  qrHeadline: string;
  qrUrl: string;
  qrCta: string;
  heroBanner: UploadFileResponse[];
  sponsorLogo: UploadFileResponse[];
  advisorLogo: UploadFileResponse[];
};

export type MissingRetirementFlyerFields = {
  planId: string;
  planName: string;
  language: "English" | "Spanish";
  bodyText: string;
  callToAction: string;
  qrUrl: string;
  qrCta: string;
  sponsorLogo: UploadFileResponse[];
  advisorLogo: UploadFileResponse[];
  piggyBankImage: UploadFileResponse[];
};

