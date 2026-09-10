"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mb-16 items-center justify-center text-center">
      <span className="bg-gradient-to-b from-foreground to-transparent bg-clip-text text-[10rem] font-extrabold leading-none text-transparent">
        404
      </span>
      <h2 className="my-2 font-heading text-2xl font-bold">
        Something&apos;s missing
      </h2>
      <p>
        Sorry, the page you are looking for doesn&apos;t exist or has been
        moved.
      </p>
      <div className="mt-8 flex justify-center gap-2">
        <Button onClick={() => router.back()} variant="default" size="lg">
          Go back
        </Button>
        <Button
          onClick={() => {
            // Navigate to the dashboard on the current host. On Plantel hosts
            // (apex/subdomains of plantel.pro) always go to the apex domain's
            // dashboard, never to a subdomain (subdomains only serve the public
            // portal, e.g. /{slug}). On any other host — e.g. a Vercel
            // preview/dev domain like plantel-dev.vercel.app — stay on that
            // host instead of bouncing the user to production.
            const rootDomain =
              process.env.NEXT_PUBLIC_ROOT_DOMAIN || "plantel.pro";
            const host = (window.location.hostname || "").toLowerCase();
            const isPlantelHost =
              host === rootDomain || host.endsWith(`.${rootDomain}`);
            window.location.href = isPlantelHost
              ? `https://${rootDomain}/dashboard`
              : `${window.location.origin}/dashboard`;
          }}
          variant="ghost"
          size="lg"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
}
