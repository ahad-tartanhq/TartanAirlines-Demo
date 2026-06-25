import type { Lang } from "../config";
import { en } from "./en";
import { hi } from "./hi";
import { ne } from "./ne";
import { bn } from "./bn";
import { si } from "./si";
import { ar } from "./ar";

export const dictionaries: Record<Lang, Record<string, string>> = {
  en,
  hi,
  ne,
  bn,
  si,
  ar,
};
