"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { authService } from "@/services/auth.service";
import { profileService } from "@/services/profile.service";

const localeMap: Record<string, string> = {
  en: "en",
  hi: "hi",
  bn: "bn",
  ur: "ur",
  ne: "ne",
};

export function LocaleDir() {
  const { data: session } = authService.useSession();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileService.get(),
    enabled: Boolean(session),
  });
  const language = profile.data?.language ?? "en";
  const lang = localeMap[language] ?? "en";
  const dir = lang === "ur" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  return null;
}
