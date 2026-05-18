import Image from "next/image";

interface NewsEventsHeaderProps {
  title?: string;
  backgroundImage?: string;
  backgroundImageAlt?: string;
}

export function NewsEventsHeader({
  title = "News & Events",
  backgroundImage = "/announcement-banner-3.webp",
  backgroundImageAlt = "Audience at event",
}: NewsEventsHeaderProps) {
  return (
    <section className="relative h-[400px] w-full overflow-hidden">
      {/* Background Image */}
      <Image
        src={backgroundImage}
        alt={backgroundImageAlt}
        fill
        className="object-cover"
        priority
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Center content block */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="bg-black/60 backdrop-blur-sm rounded-xl w-[900px] px-12 py-10">
          <h1 className="font-dm-serif text-white text-[48px] text-center">
            {title}
          </h1>
        </div>
      </div>
    </section>
  );
}
