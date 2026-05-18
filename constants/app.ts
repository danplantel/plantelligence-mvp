export const AWS_REGION = process.env.AWS_REGION!;
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
export const AWS_SECRET_ACCESS_KEY =
  process.env.AWS_SECRET_ACCESS_KEY!;
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME!;

// Cloudflare R2 (S3-compatible) — used for plan docs, branding images, generated assets
export const R2_BUCKET = process.env.R2_BUCKET ?? "";
export const R2_ENDPOINT = process.env.R2_ENDPOINT ?? "";
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
export const R2_PUBLIC_HOST = process.env.R2_PUBLIC_HOST ?? ""; // optional: custom domain for signed URL host, if different from endpoint

export const SYNTHESIA_API_KEY = process.env.NEXT_PUBLIC_SYNTHESIA_API_KEY;
export const SYNTHESIA_TEMPLATE_ID = "228527cd-784c-404b-987c-6f9b206aea61"; 
// export const SYNTHESIA_TEMPLATE_ID = "c85fb514-f21c-4d0c-9548-123465152536";

export const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY; 
