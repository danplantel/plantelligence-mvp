"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";
import { KeyContact } from "@/types/new-client-wizard";
import { formatPhoneWithExtension } from "@/lib/phone-utils";
import { readableColor } from "polished";
import { BrandingImage } from "@/components/ui/branding-image";
import { Headshot } from "@/components/ui/headshot";

interface PortalTeamProps {
  keyContacts?: KeyContact[];
  brandColor?: string;
  secondaryColor?: string;
  hideTitle?: boolean;
  baselineBackgroundColor?: string;
}

export function PortalTeam({
  keyContacts = [],
  brandColor = "#002B5B",
  secondaryColor = "#C89B5B",
  hideTitle = false,
  baselineBackgroundColor,
}: PortalTeamProps) {
  const contacts = keyContacts.filter((c) => c.showOnPortal);

  return (
    <section style={{ background: "#FFFFFF", padding: "40px 0" }}>
      {!hideTitle && (
        <h2
          style={{
            textAlign: "center",
            color: "#002B5B",
            fontSize: "48px",
            fontWeight: 700,
            marginBottom: "50px",
            fontFamily: "DM Serif Display, serif",
          }}
        >
          Contact Us
        </h2>
      )}

      {/* FIXED GRID 4 per row */}
      <div
        className="mx-auto"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "40px",
          maxWidth: "1200px",
          justifyItems: "center",
        }}
      >
        {contacts.map((contact, index) => {
          const avatarSrc = contact.headshot || contact.teamImage;
          return (
          <Card
            key={index}
            style={{
              background: contact.cardBackgroundColor || baselineBackgroundColor || brandColor,
              borderRadius: "12px",
              width: "280px",
              height: "auto",
              minHeight: "340px",
              border: "1px solid #D0D0D0",
              padding: "20px 20px 30px",
            }}
          >
            <CardContent
              style={{
                textAlign: "center",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "22px",
              }}
            >
              {/* Headshot (circle) or placeholder — use Headshot for stable center crop like benefits team */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: `${90 * (contact.logoScale || 1)}px`,
                }}
              >
                {avatarSrc ? (
                  <div
                    style={{
                      height: `${90 * (contact.logoScale || 1)}px`,
                      width: `${90 * (contact.logoScale || 1)}px`,
                      borderRadius: "9999px",
                      overflow: "hidden",
                      opacity: 0.95,
                    }}
                  >
                    <Headshot
                      src={avatarSrc}
                      alt={
                        contact.displayName ||
                        contact.name ||
                        [contact.firstName, contact.lastName]
                          .filter(Boolean)
                          .join(" ")
                          .trim() ||
                        "Contact"
                      }
                      wrapperClassName="h-full w-full"
                    />
                  </div>
                ) : (
                  <BrandingImage
                    src="/logo-placeholder.png"
                    alt="Placeholder"
                    className="max-h-full w-auto"
                    style={{
                      height: `${90 * (contact.logoScale || 1)}px`,
                      width: "auto",
                      objectFit: "contain",
                      opacity: 0.8,
                    }}
                  />
                )}
              </div>

              {/* Title */}
              <h3
                style={{
                  color: readableColor(contact.cardBackgroundColor || baselineBackgroundColor || brandColor),
                  fontSize: "24px",
                  fontWeight: 700,
                  lineHeight: "1.3",
                  fontFamily: "DM Serif Display, serif",
                }}
              >
                {contact.title || contact.customRole || "Contact"}
              </h3>

              {/* Phone */}
              {contact.phone && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: readableColor(contact.cardBackgroundColor || baselineBackgroundColor || brandColor),
                    opacity: 0.9,
                    fontSize: "16px",
                  }}
                >
                  <Phone size={20} color={readableColor(contact.cardBackgroundColor || baselineBackgroundColor || brandColor)} />
                  <span>
                    {formatPhoneWithExtension(contact.phone, contact.phoneExtension)}
                  </span>
                </div>
              )}

              {/* Email */}
              {contact.email && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: readableColor(contact.cardBackgroundColor || baselineBackgroundColor || brandColor),
                    opacity: 0.9,
                    fontSize: "16px",
                  }}
                >
                  <Mail size={20} color={readableColor(contact.cardBackgroundColor || baselineBackgroundColor || brandColor)} />
                  <span>{contact.email}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
        })}
      </div>
    </section>
  );
}

/* (000) 000-0000 formatting */
function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 10) return phone;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
    6,
    10,
  )}`;
}
