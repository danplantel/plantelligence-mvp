interface NewsEventsHeaderProps {
  title?: string;
  backgroundImage?: string;
  backgroundImageAlt?: string;
}

/**
 * Hero for the News & Events page.
 *
 * The background is a plain <img>, like the other portal heroes (PortalHero,
 * PortalWelcomeBanner), rather than next/image. The value arrives resolved by
 * `useBrandingImageUrl`, so it is either the /api/r2/object proxy or a presigned
 * R2 URL — and routing either through the Image Optimizer adds a server-side
 * fetch that can fail in production, on top of the double compression the
 * optimizer applies to already-optimized R2 bytes.
 *
 * When the plan has no Secondary Banner selected (Create Plan wizard / Edit
 * Client), the caller passes nothing and the bundled default below is used.
 */
export function NewsEventsHeader({
  title = "News & Events",
  backgroundImage = "/news-events-default-bg.webp",
  backgroundImageAlt = "Audience at event",
}: NewsEventsHeaderProps) {
  return (
    <section className="relative h-[280px] sm:h-[350px] lg:h-[400px] w-full overflow-hidden">
      {/* Background Image */}
      {backgroundImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundImage}
          alt={backgroundImageAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

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
