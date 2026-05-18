"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export interface Announcement {
  id: string;
  title: string;
  content: string[];
  image: string;
  imageAlt: string;
  link: string;
}

interface NewsEventsAnnouncementsProps {
  brandColor?: string;
  secondaryColor?: string;
  announcements?: Announcement[];
}

const defaultAnnouncements: Announcement[] = [
  {
    id: "1",
    title: "Announcement #1",
    content: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo. Orem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.",
    ],
    image:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80",
    imageAlt: "Speaker presenting at event",
    link: "#",
  },
  {
    id: "2",
    title: "Announcement #2",
    content: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo. Orem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.",
    ],
    image:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    imageAlt: "Audience at event",
    link: "#",
  },
  {
    id: "3",
    title: "Announcement #3",
    content: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo. Orem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.",
    ],
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=80",
    imageAlt: "Professional woman at event",
    link: "#",
  },
  {
    id: "4",
    title: "Announcement #4",
    content: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo. Orem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.",
    ],
    image:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80",
    imageAlt: "Networking event",
    link: "#",
  },
];

export function NewsEventsAnnouncements({
  brandColor = "#1F3A60",
  secondaryColor = "#C9A961",
  announcements = defaultAnnouncements,
}: NewsEventsAnnouncementsProps) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 bg-gray-100">
      <div className="mx-auto max-w-7xl">
        <h2
          className="mb-12 text-center font-dm-serif text-[40px] font-normal leading-tight"
          style={{ color: brandColor }}
        >
          Announcement
        </h2>

        <div className="space-y-8">
          {announcements.map((announcement, index) => {
            const fadeUp = {
              hidden: { opacity: 0, y: 200 },
              visible: { opacity: 1, y: 0 },
            };

            return (
              <motion.div
                key={announcement.id}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{
                  opacity: { duration: 0.2, delay: index * 0.1 },
                  y: { duration: 0.6, delay: index * 0.1, ease: "easeOut" },
                }}
                className="relative overflow-hidden rounded-2xl shadow-xl h-[280px] transition-all duration-300 ease-in-out hover:-translate-y-4 hover:scale-[1.05] hover:shadow-2xl cursor-pointer"
              >
                {/* Background Image */}
                <div className="absolute inset-0">
                  <Image
                    src={announcement.image}
                    alt={announcement.imageAlt}
                    fill
                    className="object-cover"
                  />
                  {/* Dark Overlay with Shadow Transition */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black from-40% via-black/90 via-65% to-transparent" />
                </div>

                {/* Content Overlay */}
                <div className="relative z-10 flex h-full flex-col justify-between p-6 lg:p-10 lg:pr-[50%]">
                  <div>
                    <h3 className="mb-3 font-dm-serif text-[28px] font-normal leading-tight text-white">
                      {announcement.title}
                    </h3>
                    <div className="space-y-2 text-[15px] leading-relaxed text-gray-200 font-red-hat">
                      {announcement.content.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      asChild
                      className="px-6 py-5 text-sm font-red-hat font-semibold uppercase tracking-wide transition-all duration-300 hover:opacity-90 hover:scale-105"
                      style={{
                        backgroundColor: secondaryColor,
                        color: "white",
                      }}
                    >
                      <a href={announcement.link}>
                        Learn More
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </a>
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
