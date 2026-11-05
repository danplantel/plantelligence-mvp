/**
 * How long a webinar's video runs — measured at upload, never at read time.
 *
 * The portal card prints this as a badge. Measuring it in the browser from the
 * stored payload meant downloading several megabytes of base64 just to show
 * "3:42", and printing nothing whenever that fetch was slow or blocked. So the
 * creator measures the picked file and stores the string on the row.
 */

/**
 * A runtime in seconds as the badge prints it — `m:ss`, or `h:mm:ss` past an
 * hour. `undefined` when there is nothing usable to show, so the caller can omit
 * the field instead of writing "0:00".
 */
export function formatRuntimeBadge(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}

/**
 * Read a picked file's duration, best-effort.
 *
 * Resolves 0 rather than hanging when the browser cannot decode the file, or
 * when there are no blob URLs at all (jsdom, a locked-down host). The timer is
 * what keeps a file that fires no event from holding the blob forever.
 */
export function measureVideoRuntime(file: File): Promise<number> {
  if (typeof URL?.createObjectURL !== "function") return Promise.resolve(0);

  let objectUrl: string;
  try {
    objectUrl = URL.createObjectURL(file);
  } catch {
    return Promise.resolve(0);
  }

  return new Promise((resolve) => {
    const probe = document.createElement("video");
    const finish = (seconds: number) => {
      window.clearTimeout(timer);
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Already revoked, or never created a working URL.
      }
      probe.removeAttribute("src");
      resolve(seconds);
    };
    const timer = window.setTimeout(() => finish(0), 10000);
    probe.preload = "metadata";
    probe.onloadedmetadata = () => finish(probe.duration || 0);
    probe.onerror = () => finish(0);
    probe.src = objectUrl;
  });
}
