export function initials(name?: string) {
  if (!name) return "NA";
  const parts = name.split(" ");
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

export function formatPhone(phone?: string) {
  if (!phone) return "";

  // Extract only digits
  const cleaned = phone.replace(/\D/g, "");

  // If number starts with 1 and has 11 digits, use last 10 digits
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const last10 = cleaned.slice(1);
    return `+1 (${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(
      6,
      10,
    )}`;
  }

  // If it's a 10-digit number, format as +1 (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
      6,
      10,
    )}`;
  }

  // For any other length, try to format with last 10 digits
  if (cleaned.length > 10) {
    const last10 = cleaned.slice(-10);
    return `+1 (${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(
      6,
      10,
    )}`;
  }

  // If less than 10 digits, just add +1 prefix
  return `+1 ${cleaned}`;
}

