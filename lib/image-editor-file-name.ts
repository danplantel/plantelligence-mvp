/**
 * File names for the images the crop editors save.
 *
 * Shared by `UniversalImageEditorModal` and `SimpleImageEditorModal` so the two
 * cannot drift — they were each inventing their own name, which is how the same
 * slot ended up as "photo_edited.png" on one path and "company_logo_cropped.png"
 * on the other.
 *
 * Two rules:
 *
 *  1. **The advisor's own file name wins.** Both editors used to rewrite the
 *     name — appending a suffix ("_edited", "_cropped"), and for logos and
 *     headshots replacing it outright with a fixed string. None of those is the
 *     file the advisor uploaded, so the stored image was unrecognisable in the
 *     card and in R2.
 *  2. **A gallery pick reads as "Default image".** Images chosen from the
 *     default-image galleries arrive named `default-image.<ext>` (see the
 *     `ModalGallery` call sites). That is an implementation detail of the
 *     picker, not a caption, so it is replaced with plain wording.
 *
 * The export's real format is carried by the data URL (and so by the upload's
 * content type), not by the extension here — the name is a label, not a
 * promise. That is why a JPEG-named file is not renamed to ".png" when the crop
 * is re-encoded.
 */

/** Shown in place of the picker's internal `default-image.<ext>` name. */
export const DEFAULT_IMAGE_FILE_NAME = "Default image";

/** True for a name the default-image galleries generate. */
function isDefaultImageName(name: string): boolean {
  return /^default[-_ ]?image\b/i.test(name);
}

/**
 * The name an edited image should carry.
 *
 * @param original The picked file's name, or the `fileName` already stored
 *   against the slot. Empty when neither is known.
 * @param fallback Used only when there is no name at all — a slot that has
 *   never been given a file. Lets a caller keep a meaningful default per type
 *   ("logo.png") instead of a generic one.
 */
export function editorOutputFileName(
  original: string,
  fallback = "image.png",
): string {
  const name = (original || "").trim();
  if (!name) return fallback;
  return isDefaultImageName(name) ? DEFAULT_IMAGE_FILE_NAME : name;
}
