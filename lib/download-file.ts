export async function downloadFileFromUrl(
  fileUrl: string,
  filename: string,
): Promise<void> {
  if (!fileUrl) {
    throw new Error("Missing file URL");
  }

  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error("Unable to fetch file");
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(blobUrl);
}

