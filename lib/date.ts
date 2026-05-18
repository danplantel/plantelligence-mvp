import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const formNow = (date: dayjs.ConfigType) => {
  return dayjs(date).fromNow();
};

const US_DATE_OPTS: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
};

const US_TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

/** Display dates as MM/DD/YYYY (US). */
export function formatUsDate(
  input: Date | string | number | null | undefined,
): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", US_DATE_OPTS).format(d);
}

/** Display time in US locale (12-hour). */
export function formatUsTime(
  input: Date | string | number | null | undefined,
): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", US_TIME_OPTS).format(d);
}
