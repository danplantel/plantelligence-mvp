import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  MAX_UPLOAD_BYTES,
  computeBackgroundMask,
} from "@/lib/background-removal.server";

/**
 * Background removal for the universal image editor.
 *
 * Takes a downscaled copy of the logo as `multipart/form-data` (field: `image`) and
 * returns the predicted alpha matte as a PNG — RGBA, matte in the alpha channel, which
 * is the channel the client composites with. The client never uploads the artwork it
 * actually saves: it keeps its own full-resolution original and applies the mask to it,
 * so what is stored on R2 is still the user's pixels, cropped and sized by the editor.
 *
 * Why downscaled on the way in: the model's input is 1024², so sending more would be
 * upload cost for no accuracy. It also keeps the request well inside the platform body
 * limit (4.5 MB on Vercel), which the original 5 MB logo — ~6.7 MB once base64'd, or
 * simply a large PNG — would not.
 */

/**
 * Native ONNX Runtime and sharp. The edge runtime has neither, and `onnxruntime-node`
 * is externalised in `next.config.js` so its platform binaries are loaded rather than
 * bundled (bundling rewrites the paths it resolves them by).
 */
export const runtime = "nodejs";

/**
 * Generous because a cold instance downloads the weights (~168 MB, once) before it can
 * answer. The platform clamps this to the plan's ceiling, which is the real limit.
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart form upload." },
      { status: 400 },
    );
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No image was uploaded." },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "That image is too large to process." },
      { status: 413 },
    );
  }

  try {
    const mask = await computeBackgroundMask(
      Buffer.from(await file.arrayBuffer()),
    );
    return new NextResponse(new Uint8Array(mask), {
      status: 200,
      headers: {
        "content-type": "image/png",
        // A mask is per-image and per-request; nothing about it should ever be reused.
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    // The client falls back to the colour pipeline on any failure here, and tells the
    // user which method ran — so the message is for the logs, not the user.
    console.error("[remove-background] failed:", error);
    return NextResponse.json(
      { error: "The background model could not process this image." },
      { status: 500 },
    );
  }
}
