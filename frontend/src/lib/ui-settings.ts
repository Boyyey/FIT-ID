const STORAGE_KEY = "fitid.ui.v1";

export type ThemeMode = "light" | "dark" | "system";

/** Preset retailers for optional deal nudges (display names). */
export const DEAL_BRAND_PRESETS = ["Gap", "Levi's", "Zara", "H&M", "ASOS", "Nike"] as const;

export type DealReminderSettings = {
  enabled: boolean;
  /** Epoch ms — next time we may show a browser notification (if permitted). */
  nextReminderAt: number;
  brands: string[];
};

export type UiSettings = {
  theme: ThemeMode;
  accent: "teal" | "violet" | "emerald" | "amber" | "rose";
  reduceMotion: boolean;
  /** JPEG/PNG data URL from an uploaded profile photo (preferred over avatarUrl). */
  avatarDataUrl?: string;
  /** Optional legacy URL; generated avatar is used when both are empty. */
  avatarUrl?: string;
  /** Gentle reminders to check member sales (local only; uses Notification API if allowed). */
  dealReminders: DealReminderSettings;
};

const defaultDealReminders: DealReminderSettings = {
  enabled: false,
  nextReminderAt: 0,
  brands: ["Gap", "Levi's"]
};

/** Default UI prefs (SSR-safe; matches first paint before `loadUiSettings`). */
export const UI_SETTINGS_DEFAULT: UiSettings = {
  theme: "light",
  accent: "teal",
  reduceMotion: false,
  avatarUrl: "",
  avatarDataUrl: "",
  dealReminders: defaultDealReminders
};

export function loadUiSettings(): UiSettings {
  if (typeof window === "undefined") return UI_SETTINGS_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return UI_SETTINGS_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      ...UI_SETTINGS_DEFAULT,
      ...parsed,
      dealReminders: { ...defaultDealReminders, ...parsed.dealReminders }
    };
  } catch {
    return UI_SETTINGS_DEFAULT;
  }
}

export function saveUiSettings(partial: Partial<UiSettings>): UiSettings {
  const cur = loadUiSettings();
  const next: UiSettings = {
    ...cur,
    ...partial,
    dealReminders: partial.dealReminders ? { ...cur.dealReminders, ...partial.dealReminders } : cur.dealReminders
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    applyUiSettingsToDocument(next);
    window.dispatchEvent(new Event("fitid-ui-updated"));
  }
  return next;
}

export function effectiveDarkTheme(theme: ThemeMode): boolean {
  if (typeof window === "undefined") return false;
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyUiSettingsToDocument(s: UiSettings): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const dark = effectiveDarkTheme(s.theme);
  root.classList.toggle("dark", dark);
  root.setAttribute("data-accent", s.accent);
  root.classList.toggle("reduce-motion", s.reduceMotion);
}

export function defaultAvatarFromEmail(email: string): string {
  const seed = encodeURIComponent(email || "fitid");
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4`;
}

const REMINDER_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;

/** Fire a single browser notification when due (permission must be granted). Reschedules locally. */
export function maybeFireDealReminder(): void {
  if (typeof window === "undefined") return;
  const s = loadUiSettings();
  if (!s.dealReminders.enabled) return;
  const now = Date.now();
  if (s.dealReminders.nextReminderAt && now < s.dealReminders.nextReminderAt) return;
  const brands =
    s.dealReminders.brands.length > 0 ? s.dealReminders.brands.join(", ") : "your saved retailers";
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("FitID — fashion deals", {
        body: `Time to check ${brands} for member sales, clearance, and new drops.`,
        tag: "fitid-deals"
      });
    } catch {
      /* ignore */
    }
  }
  saveUiSettings({
    dealReminders: {
      ...s.dealReminders,
      nextReminderAt: now + REMINDER_INTERVAL_MS
    }
  });
}
