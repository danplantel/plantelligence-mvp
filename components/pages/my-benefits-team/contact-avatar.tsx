"use client";

import { Headshot } from "@/components/ui/headshot";
import { initials } from "@/components/pages/my-benefits-team/utils";

interface Contact {
  name?: string;
  headshot?: string;
  teamImage?: string;
}

interface ContactAvatarProps {
  contact: Contact;
}

export function ContactAvatar({ contact }: ContactAvatarProps) {
  const displayImage = contact.headshot || contact.teamImage;

  return (
    <Headshot
      src={displayImage}
      alt="Avatar"
      fallback={
        <span className="text-lg text-gray-400">
          {initials(contact.name)}
        </span>
      }
    />
  );
}
