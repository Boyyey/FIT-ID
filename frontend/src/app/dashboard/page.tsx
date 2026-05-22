"use client";

import Image from "next/image";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FashionHubPanel } from "@/components/fashion/FashionHubPanel";
import { fetchProfile, getRecommendations } from "@/lib/api";
import { clearFitIdSession, getFitIdSession, type FitIdSession } from "@/lib/auth";
import {
  DEAL_BRAND_PRESETS,
  defaultAvatarFromEmail,
  loadUiSettings,
  maybeFireDealReminder,
  saveUiSettings,
  UI_SETTINGS_DEFAULT,
  type ThemeMode,
  type UiSettings
} from "@/lib/ui-settings";

const PRODUCT_SEED = [
  { sku: "ZR-001", title: "Relaxed Linen Shirt", fit_tags: ["relaxed"], material_tags: ["linen"], color_family: "beige" },
  { sku: "ZR-002", title: "Regular Cotton Tee", fit_tags: ["regular"], material_tags: ["cotton"], color_family: "white" },
  { sku: "ZR-003", title: "Slim Technical Jacket", fit_tags: ["slim"], material_tags: ["polyester"], color_family: "black" }
];

type Tab = "overview" | "insights" | "fashion" | "settings";

function fileToResizedDataUrl(file: File, maxSide: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Canvas unsupported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };
    img.src = objectUrl;
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<FitIdSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [loadingData, setLoadingData] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [uiDraft, setUiDraft] = useState<UiSettings>(UI_SETTINGS_DEFAULT);
  const [settingsSaved, setSettingsSaved] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSession(getFitIdSession());
      setUiDraft(loadUiSettings());
      setAuthChecked(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!session?.email) {
      router.replace("/");
    }
  }, [authChecked, router, session?.email]);

  const loadData = useCallback(async () => {
    if (!session?.email) return;
    try {
      setLoadingData(true);
      setError("");
      const profileData = await fetchProfile(session.email);
      setProfile(profileData);
      const ranked = await getRecommendations(session.email, PRODUCT_SEED);
      setRecommendations(ranked);
    } catch {
      setError("Unable to load dashboard data. Ensure the backend is running and your profile exists.");
    } finally {
      setLoadingData(false);
    }
  }, [session]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadData]);

  useEffect(() => {
    const onUi = () => setUiDraft(loadUiSettings());
    window.addEventListener("fitid-ui-updated", onUi);
    return () => window.removeEventListener("fitid-ui-updated", onUi);
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    const t = window.setTimeout(() => maybeFireDealReminder(), 0);
    return () => window.clearTimeout(t);
  }, [authChecked]);

  const avatarEmail = authChecked ? (session?.email ?? "fitid") : "fitid";
  const avatarSrc =
    (uiDraft.avatarDataUrl && uiDraft.avatarDataUrl.trim()) ||
    (uiDraft.avatarUrl && uiDraft.avatarUrl.trim()) ||
    defaultAvatarFromEmail(avatarEmail);

  const avatarUnoptimized =
    avatarSrc.startsWith("data:image") || avatarSrc.includes("dicebear") || avatarSrc.includes("avataaars");

  async function onAvatarFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 320, 0.85);
      setUiDraft((d) => ({ ...d, avatarDataUrl: dataUrl, avatarUrl: "" }));
    } catch {
      setSettingsSaved("Could not read that image.");
      window.setTimeout(() => setSettingsSaved(""), 2800);
    }
  }

  function clearCustomAvatar() {
    setUiDraft((d) => ({ ...d, avatarDataUrl: "", avatarUrl: "" }));
  }

  function handleSignOut() {
    clearFitIdSession();
    router.replace("/");
  }

  function handleSwitchAccount() {
    clearFitIdSession();
    router.replace("/");
  }

  function commitSettings() {
    saveUiSettings(uiDraft);
    setSettingsSaved("Preferences saved.");
    window.setTimeout(() => setSettingsSaved(""), 2800);
  }

  return (
    <main className="dashboard-app fade-in">
      <header className="dashboard-top">
        <div>
          <p className="badge" style={{ margin: 0 }}>
            FitID Dashboard
          </p>
          <h1 className="title" style={{ margin: "0.45rem 0 0" }}>
            Your fit command centre
          </h1>
          <p className="subtitle">Manage profile, recommendations, and appearance in one place.</p>
        </div>
        <div className="dashboard-user">
          <Image
            className="dashboard-avatar lift"
            src={avatarSrc}
            alt=""
            width={52}
            height={52}
            unoptimized={avatarUnoptimized}
          />
          <div>
            <p style={{ margin: 0, fontWeight: 700 }} suppressHydrationWarning>
              {profile?.full_name ?? session?.fullName ?? "FitID member"}
            </p>
            <p className="subtitle" style={{ margin: 0 }} suppressHydrationWarning>
              {session?.email ?? "..."}
            </p>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
              {session?.accountType === "business" ? (
                <Link href="/partner/console" className="badge" style={{ cursor: "pointer" }}>
                  OAuth console
                </Link>
              ) : (
                <Link href="/business" className="badge" style={{ cursor: "pointer" }}>
                  Browse business UX
                </Link>
              )}
              <Link href="/partner/demo" className="badge" style={{ cursor: "pointer" }}>
                Partner demo
              </Link>
              <Link href="/journey" className="badge" style={{ cursor: "pointer" }}>
                Body scan
              </Link>
              <Link href="/avatar" className="badge" style={{ cursor: "pointer" }}>
                3D avatar
              </Link>
            </div>
          </div>
        </div>
      </header>

      <nav className="dashboard-tabs" aria-label="Dashboard sections">
        {(
          [
            ["overview", "Overview"],
            ["insights", "Quick fits"],
            ["fashion", "Fashion Hub"],
            ["settings", "Settings"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`dashboard-tab ${tab === id ? "dashboard-tab-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="lift" style={{ paddingBottom: "1rem" }}>
        {tab === "overview" && (
          <section className="panel" style={{ borderRadius: "18px", boxShadow: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <h2 style={{ marginTop: 0 }}>Profile snapshot</h2>
                <p className="subtitle">Measurements and preferences update when you run a scan or onboarding.</p>
              </div>
              <button className="button" type="button" onClick={() => void loadData()} disabled={loadingData}>
                {loadingData ? "Refreshing…" : "Refresh data"}
              </button>
            </div>
            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

            {profile && (
              <>
                <div
                  className="panel"
                  style={{
                    marginTop: "1rem",
                    borderRadius: "14px",
                    background: "linear-gradient(120deg, #121826, #1c2d54)",
                    color: "#f8fbff",
                    boxShadow: "none"
                  }}
                >
                  <p style={{ margin: 0, opacity: 0.85 }}>Active FitID</p>
                  <p style={{ margin: "0.35rem 0 0", fontSize: "1.15rem", fontWeight: 700 }}>
                    {profile.full_name ?? session?.fullName ?? "Member"}
                  </p>
                  <p style={{ opacity: 0.9, margin: "0.25rem 0 0" }}>ID FIT-{(profile.email ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}</p>
                </div>

                <div className="grid grid-2" style={{ marginTop: "1rem" }}>
                  <article className="card" style={{ borderRadius: "14px" }}>
                    <h3 style={{ marginTop: 0 }}>Identity</h3>
                    <p className="subtitle">Posture: {profile.posture_label ?? profile.posture ?? "—"}</p>
                    <p className="subtitle">Skin tone hint: {profile.skin_tone ?? "—"}</p>
                    <p className="subtitle">
                      Shop as:{" "}
                      {profile.fit_preferences?.gender === "female"
                        ? "Women's"
                        : profile.fit_preferences?.gender === "male"
                          ? "Men's"
                          : "Not set"}
                    </p>
                  </article>
                  <article className="card" style={{ borderRadius: "14px" }}>
                    <h3 style={{ marginTop: 0 }}>Preferences</h3>
                    <p className="subtitle">Silhouette: {profile.fit_preferences?.silhouette ?? "—"}</p>
                    <p className="subtitle">Formality: {profile.fit_preferences?.formality ?? "—"}</p>
                    <p className="subtitle">Allergies: {(profile.allergies ?? []).join(", ") || "None recorded"}</p>
                    <p className="subtitle">Scan confidence: {Math.round((profile.confidence_score ?? 0) * 100)}%</p>
                  </article>
                </div>

                <div className="grid grid-2" style={{ marginTop: "0.85rem" }}>
                  {(
                    [
                      ["Height", profile.body_measurements?.height_cm, "cm"],
                      ["Weight", profile.body_measurements?.weight_kg, "kg"],
                      ["Shoulders", profile.body_measurements?.shoulder_width_cm, "cm"],
                      ["Chest", profile.body_measurements?.chest_cm, "cm"],
                      ["Waist", profile.body_measurements?.waist_cm, "cm"],
                      ["Hips", profile.body_measurements?.hip_cm, "cm"],
                      ["Inseam", profile.body_measurements?.inseam_cm, "cm"],
                      ["Torso", profile.body_measurements?.torso_length_cm, "cm"]
                    ] as const
                  ).map(([label, value, unit]) => (
                    <article key={label} className="card" style={{ borderRadius: "12px", padding: "0.85rem" }}>
                      <p className="subtitle" style={{ margin: 0 }}>
                        {label}
                      </p>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "1.15rem", fontWeight: 700 }}>
                        {value ?? "—"} {unit}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}

            {!profile && !loadingData && (
              <p className="subtitle" style={{ marginTop: "0.65rem" }}>
                No profile loaded yet — check the backend and try Refresh.
              </p>
            )}
          </section>
        )}

        {tab === "insights" && (
          <section className="panel" style={{ borderRadius: "18px", boxShadow: "none" }}>
            <h2 style={{ marginTop: 0 }}>Quick size signals</h2>
            <p className="subtitle">Shortlist from the classic recommender; FashionHub uses the full personalized engine.</p>
            {recommendations.length === 0 && <p className="subtitle">Run refresh on Overview to load matches.</p>}
            {recommendations.length > 0 && (
              <div className="grid grid-2" style={{ marginTop: "0.75rem" }}>
                {recommendations.map((item) => (
                  <article key={item.sku} className="card lift" style={{ borderRadius: "14px" }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{item.title}</p>
                    <p className="subtitle">Size {item.recommended_size}</p>
                    <p className="subtitle">Score {Math.round(item.score)}%</p>
                    <p className="subtitle" style={{ marginTop: "0.35rem" }}>{item.advice ?? item.reason}</p>
                    <span className="badge">{item.reason}</span>
                  </article>
                ))}
              </div>
            )}
            <button className="button" type="button" style={{ marginTop: "1rem" }} onClick={() => setTab("fashion")}>
              Open Fashion Hub tab
            </button>
          </section>
        )}

        {tab === "fashion" && authChecked && session?.email && (
          <div className="lift" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <FashionHubPanel email={session.email} embedded />
            <Link href="/fashion-hub" className="button secondary" style={{ alignSelf: "flex-start" }}>
              Open Fashion Hub full page
            </Link>
          </div>
        )}

        {tab === "settings" && (
          <section className="panel" style={{ borderRadius: "18px", boxShadow: "none" }}>
            <h2 style={{ marginTop: 0 }}>Settings</h2>
            <p className="subtitle">Theme, accent, motion, avatar, and account controls stay on this device.</p>

            <div className="settings-grid" style={{ marginTop: "1rem" }}>
              <div className="settings-field">
                <span className="subtitle">Profile picture</span>
                <p className="subtitle" style={{ margin: 0, fontSize: "0.88rem" }}>
                  Upload a JPEG, PNG, or WebP — resized in the browser and kept in local storage on this device.
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="input"
                  style={{ padding: "0.55rem" }}
                  onChange={(e) => void onAvatarFile(e)}
                />
                <button className="button secondary" type="button" onClick={clearCustomAvatar} style={{ marginTop: "0.35rem" }}>
                  Remove custom photo
                </button>
              </div>

              <div className="settings-field">
                <span className="subtitle">Theme</span>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`button secondary ${uiDraft.theme === m ? "theme-pill-active" : ""}`}
                      onClick={() => setUiDraft((d) => ({ ...d, theme: m }))}
                    >
                      {m === "system" ? "Match device" : m[0].toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-field">
                <span className="subtitle">Accent color</span>
                <div className="accent-pick" role="group" aria-label="Accent color">
                  {(["teal", "violet", "emerald", "amber", "rose"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`accent-chip ${a} ${uiDraft.accent === a ? "on" : ""}`}
                      title={a}
                      aria-label={a}
                      onClick={() => setUiDraft((d) => ({ ...d, accent: a }))}
                    />
                  ))}
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={uiDraft.reduceMotion}
                  onChange={(e) => setUiDraft((d) => ({ ...d, reduceMotion: e.target.checked }))}
                />
                <span className="subtitle" style={{ margin: 0 }}>
                  Reduce motion
                </span>
              </label>

              <div className="settings-field" style={{ gridColumn: "1 / -1" }}>
                <span className="subtitle">Fashion deal reminders</span>
                <p className="subtitle" style={{ margin: "0.25rem 0 0.5rem", fontSize: "0.88rem", maxWidth: 560 }}>
                  Get a gentle browser nudge every few days to check sales at brands you care about. Works only if your browser
                  allows notifications — nothing is sent to a server.
                </p>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.65rem" }}>
                  <input
                    type="checkbox"
                    checked={uiDraft.dealReminders.enabled}
                    onChange={(e) =>
                      setUiDraft((d) => ({
                        ...d,
                        dealReminders: {
                          ...d.dealReminders,
                          enabled: e.target.checked,
                          nextReminderAt: e.target.checked ? 0 : d.dealReminders.nextReminderAt
                        }
                      }))
                    }
                  />
                  <span className="subtitle" style={{ margin: 0 }}>
                    Remind me about discounts and member events
                  </span>
                </label>
                <p className="subtitle" style={{ margin: "0 0 0.35rem", fontSize: "0.82rem" }}>
                  Brands to mention in alerts
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                  {DEAL_BRAND_PRESETS.map((brand) => {
                    const on = uiDraft.dealReminders.brands.includes(brand);
                    return (
                      <button
                        key={brand}
                        type="button"
                        className={`button secondary ${on ? "theme-pill-active" : ""}`}
                        onClick={() =>
                          setUiDraft((d) => {
                            const set = new Set(d.dealReminders.brands);
                            if (set.has(brand)) set.delete(brand);
                            else set.add(brand);
                            return {
                              ...d,
                              dealReminders: { ...d.dealReminders, brands: Array.from(set) }
                            };
                          })
                        }
                      >
                        {brand}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="button secondary"
                  type="button"
                  style={{ marginTop: "0.65rem" }}
                  onClick={() => {
                    if (typeof Notification === "undefined") {
                      setSettingsSaved("Notifications are not supported in this browser.");
                      window.setTimeout(() => setSettingsSaved(""), 3200);
                      return;
                    }
                    void Notification.requestPermission().then((perm) => {
                      setSettingsSaved(
                        perm === "granted"
                          ? "Browser alerts enabled. Save preferences to keep deal reminders."
                          : perm === "denied"
                            ? "Notifications blocked — you can change this in the browser site settings."
                            : "Permission dismissed."
                      );
                      window.setTimeout(() => setSettingsSaved(""), 3800);
                    });
                  }}
                >
                  Allow browser notifications
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
              <button className="button" type="button" onClick={commitSettings}>
                Save preferences
              </button>
              <button className="button secondary" type="button" onClick={handleSwitchAccount}>
                Switch account
              </button>
              <button className="button" type="button" onClick={handleSignOut} style={{ background: "#475569" }}>
                Log out
              </button>
            </div>
            {settingsSaved && <p className="subtitle" style={{ marginTop: "0.65rem" }}>{settingsSaved}</p>}
          </section>
        )}
      </div>
    </main>
  );
}
