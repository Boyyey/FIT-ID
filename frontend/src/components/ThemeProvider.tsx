"use client";

import { useEffect } from "react";

import { applyUiSettingsToDocument, loadUiSettings } from "@/lib/ui-settings";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyUiSettingsToDocument(loadUiSettings());
    const onUpdate = () => applyUiSettingsToDocument(loadUiSettings());
    window.addEventListener("fitid-ui-updated", onUpdate);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSys = () => applyUiSettingsToDocument(loadUiSettings());
    mq.addEventListener("change", onSys);
    return () => {
      window.removeEventListener("fitid-ui-updated", onUpdate);
      mq.removeEventListener("change", onSys);
    };
  }, []);

  return <>{children}</>;
}
