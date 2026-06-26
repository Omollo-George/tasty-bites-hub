import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  digits = digits.replace(/^0+/, "");
  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }
  if (digits.length === 9) {
    return `254${digits}`;
  }
  if (digits.length === 10 && digits.startsWith("7")) {
    return `254${digits}`;
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return `254${digits.slice(1)}`;
  }
  return digits;
}

export function isValidMpesaPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^254\d{9}$/.test(normalized);
}
