/**
 * Server-side background removal.
 *
 * Server-only — the `.server.ts` suffix follows
 * [`lib/plan-needs-attention.server.ts`](lib/plan-needs-attention.server.ts:1), and the
 * route that calls this is the only importer. Nothing here may reach the client bundle:
 * it pulls in native binaries (`onnxruntime-node`, `sharp`) that cannot be bundled for a
 * browser at all.
 *
 * The model is ISNet general-use, published under MIT by IMG.LY —
 * <https://huggingface.co/imgly/isnet-general-onnx>. It predicts an alpha matte for the
 * whole frame, which is what makes a gradient, a drop shadow or a photo behind the
 * subject removable, where the colour-key pipeline (see
 * [`lib/image-background-removal.ts`](lib/image-background-removal.ts:1)) can only clear
 * a flat backdrop.
 *
 * Why this runs on the server rather than in the browser: the weights are ~168 MB. In
 * the browser every visitor paid that once; here it is paid once per deployment, by the
 * deployer, where the cost can be planned. The trade is that the pixels of an uploaded
 * logo now leave the browser — the *mask* comes back, and the artwork itself never
 * does, because the client keeps its full-resolution original and only applies the mask
 * it is given.
 *
 * Weight resolution, in order:
 *
 * 1. `BG_MODEL_PATH` (default `models/isnet-general-use.onnx`) — fetched by
 *    `pnpm run models:fetch`, and the path a container or a large-enough function should
 *    use. `next.config.js` includes `./models/**` in the route's output trace so a
 *    deployment that carries the file actually ships it.
 * 2. A download to the temp directory, once per running instance, for deployments that
 *    cannot carry 168 MB in the bundle (Vercel's unzipped function limit is 250 MB, and
 *    the native runtime takes a sizeable bite of that). Slower on a cold instance, free
 *    afterwards.
 */

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import * as ort from "onnxruntime-node";
import sharp from "sharp";

/** The model's fixed input, from the repo's `preprocessor_config.json`. */
const INPUT_SIZE = 1024;
/** Normalisation: `(v - mean) / std` over 0-255 channels, no rescale step. */
const INPUT_MEAN = 128;
const INPUT_STD = 256;

/** Expected weight size; a short file is treated as missing rather than loaded. */
const MODEL_BYTES = 176_149_806;

const MODEL_PATH = resolve(
  process.cwd(),
  process.env.BG_MODEL_PATH || "models/isnet-general-use.onnx",
);
const MODEL_URL =
  process.env.BG_MODEL_URL ||
  "https://huggingface.co/imgly/isnet-general-onnx/resolve/main/onnx/model.onnx";

/**
 * Largest image this will accept, before decoding.
 *
 * The client sends a 1024² derivative rather than the original — the model only ever
 * sees 1024² — so anything near this ceiling is already abnormal. It exists to stop a
 * hostile caller from handing `sharp` an enormous decode.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * The loaded session, kept across requests.
 *
 * On `globalThis` for the same reason [`lib/prisma.ts`](lib/prisma.ts:1) does it: in
 * development Next.js re-evaluates modules on every edit, and a session per module
 * instance would re-read 168 MB from disk each time. A promise is stored rather than the
 * session so concurrent first requests share one load instead of racing.
 */
const globalForModel = globalThis as unknown as {
  bgRemovalSession?: Promise<ort.InferenceSession>;
};

/** Resolved model file path, cached for the life of the instance. */
let modelFilePromise: Promise<string> | null = null;

async function isUsableModelFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    // A truncated file is worse than a missing one: loading it fails deep inside the
    // protobuf parser, where the error reads like corruption rather than a bad download.
    return info.size >= MODEL_BYTES * 0.99;
  } catch {
    return false;
  }
}

async function downloadModel(destination: string): Promise<void> {
  const response = await fetch(MODEL_URL);
  if (!response.ok || !response.body) {
    throw new Error(
      `Could not download the background model (HTTP ${response.status}).`,
    );
  }

  const source = Readable.fromWeb(
    response.body as Parameters<typeof Readable.fromWeb>[0],
  );
  await pipeline(source, createWriteStream(destination));

  if (!(await isUsableModelFile(destination))) {
    throw new Error("The background model download was incomplete.");
  }
}

/**
 * Path to the weights, downloading them once per instance when the deployment did not
 * ship them. Both paths are memoised, so only the first request after a cold start pays.
 */
function ensureModelFile(): Promise<string> {
  if (!modelFilePromise) {
    modelFilePromise = (async () => {
      if (await isUsableModelFile(MODEL_PATH)) return MODEL_PATH;

      // Named after the URL so repointing `BG_MODEL_URL` at a different model cannot
      // silently reuse the previous one's cache.
      const digest = createHash("sha1").update(MODEL_URL).digest("hex").slice(0, 10);
      const cached = join(tmpdir(), `pt-bg-model-${digest}.onnx`);
      if (await isUsableModelFile(cached)) return cached;

      await downloadModel(cached);
      return cached;
    })().catch((error) => {
      // Do not memoise a failure: the next request should be able to try again.
      modelFilePromise = null;
      throw error;
    });
  }
  return modelFilePromise;
}

function getSession(): Promise<ort.InferenceSession> {
  if (!globalForModel.bgRemovalSession) {
    globalForModel.bgRemovalSession = (async () => {
      const modelPath = await ensureModelFile();
      return ort.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
      });
    })().catch((error) => {
      globalForModel.bgRemovalSession = undefined;
      throw error;
    });
  }
  return globalForModel.bgRemovalSession;
}

/**
 * Build the model's input tensor: one 1024² RGB frame, NCHW, normalised.
 *
 * Transparency is flattened onto white first. The model was trained on opaque images,
 * and a logo that already carries alpha would otherwise be segmented with its
 * transparent regions read as black — which is how a pale mark on a transparent
 * background ends up with holes in it. Flattening is safe because the client applies the
 * returned mask to its own original, whose alpha is still there.
 */
async function buildInput(input: Buffer): Promise<Float32Array> {
  const { data, info } = await sharp(input)
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(pixels * 3);
  const channels = info.channels;

  for (let index = 0; index < pixels; index++) {
    const offset = index * channels;
    tensor[index] = (data[offset] - INPUT_MEAN) / INPUT_STD;
    tensor[pixels + index] = (data[offset + 1] - INPUT_MEAN) / INPUT_STD;
    tensor[pixels * 2 + index] = (data[offset + 2] - INPUT_MEAN) / INPUT_STD;
  }

  return tensor;
}

/**
 * Pick the mask head out of the session's outputs.
 *
 * ISNet exports carry intermediate score maps next to the mask, and their order is not
 * guaranteed, so the mask is identified by shape: the only single-channel output at the
 * input resolution.
 */
function selectMaskOutput(
  session: ort.InferenceSession,
  outputs: ort.InferenceSession.OnnxValueMapType,
): ort.Tensor {
  const produced = session.outputNames
    .map((name) => outputs[name])
    .filter((value): value is ort.Tensor => value instanceof ort.Tensor);

  const mask = produced.find((tensor) => {
    const dims = tensor.dims;
    if (dims.length < 2) return false;
    const height = dims[dims.length - 2];
    const width = dims[dims.length - 1];
    const channels = dims.length >= 3 ? dims[dims.length - 3] : 1;
    return channels === 1 && width === INPUT_SIZE && height === INPUT_SIZE;
  });

  if (!mask) throw new Error("The model returned no mask.");
  return mask;
}

/**
 * Remove the background from `input` and return the alpha matte as a PNG.
 *
 * PNG rather than raw bytes so the client can hand the result straight to a canvas, and
 * RGBA with the matte in the alpha channel because that is the channel `destination-in`
 * composites with — a greyscale PNG would come back fully opaque and do nothing. The
 * RGB channels are white: they are never read, and white makes the mask legible if
 * anyone opens the response by hand.
 */
export async function computeBackgroundMask(input: Buffer): Promise<Buffer> {
  const session = await getSession();

  const tensor = new ort.Tensor("float32", await buildInput(input), [
    1,
    3,
    INPUT_SIZE,
    INPUT_SIZE,
  ]);

  const outputs = await session.run({
    [session.inputNames[0]]: tensor,
  });
  const mask = selectMaskOutput(session, outputs);

  const data = mask.data as Float32Array;
  const pixels = INPUT_SIZE * INPUT_SIZE;
  if (data.length < pixels) {
    throw new Error("The model returned a mask of the wrong size.");
  }

  // The head emits logits, not probabilities, and they are not normalised. Min-max
  // scaling is what the reference implementations do with this model, and it is what
  // keeps an anti-aliased edge soft instead of turning it into a threshold line.
  let min = Infinity;
  let max = -Infinity;
  for (let index = 0; index < pixels; index++) {
    const value = data[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min;

  const rgba = Buffer.allocUnsafe(pixels * 4);
  for (let index = 0; index < pixels; index++) {
    const offset = index * 4;
    const alpha = span > 0 ? ((data[index] - min) / span) * 255 : 255;
    rgba[offset] = 255;
    rgba[offset + 1] = 255;
    rgba[offset + 2] = 255;
    rgba[offset + 3] = Math.max(0, Math.min(255, Math.round(alpha)));
  }

  return sharp(rgba, {
    raw: { width: INPUT_SIZE, height: INPUT_SIZE, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
