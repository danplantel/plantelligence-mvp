export function ErrorMessage({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <p className="text-sm text-red-500 mt-1">{error}</p>;
}
