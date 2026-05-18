import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import bcrypt from "bcryptjs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, await bcrypt.genSalt());
}

export function customValue(value?: string, custom?: string) {
  if (value === "custom") {
    return custom || "";
  }
  return value || "";
}
