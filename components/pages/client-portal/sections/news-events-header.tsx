import Image from "next/image";

interface NewsEventsHeaderProps {
  title?: string;
  backgroundImage?: string;
  backgroundImageAlt?: string;
}

/** R2 proxy URLs are already served at full resolution — letting Next.js
 *  Image Optimization re-process them degrades quality (double compression).
 *  Local public assets (e.g. /announcement-banner-3.webp) still benefit
 *  from Next.js optimization. */
function isR2ProxyUrl(src: string): boolean {
  return src.startsWith("/api/r2/object");
}

export function NewsEventsHeader({
  title = "News & Events",
  backgroundImage = "/announcement-banner-3.webp",
  backgroundImageAlt = "Audience at event",
}: NewsEventsHeaderProps) {
  const unoptimized = isR2ProxyUrl(backgroundImage);

  return (
    <section className="relative h-[280px] sm:h-[350px] lg:h-[400px] w-full overflow-hidden">
      {/* Background Image */}
      <Image
        src={backgroundImage}
        alt={backgroundImageAlt}
        fill
        className="object-cover"
        priority
        unoptimized={unoptimized}
        quality={unoptimized ? undefined : 90}
        sizes="100vw"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 sm:bg-black/30" />

      {/* Center content block */}
      <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-6">
        <div className="bg-black/60 backdrop-blur-sm rounded-xl w-full max-w-[90%] sm:max-w-[700px] lg:w-[900px] px-6 py-6 sm:px-10 sm:py-8 lg:px-12 lg:py-10">
          <h1 className="font-dm-serif text-white text-3xl sm:text-[40px] lg:text-[48px] text-center leading-tight">
            {title}
          </h1>
        </div>
      </div>
    </section>
  );
}
