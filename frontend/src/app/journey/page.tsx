"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import {
  fetchProfile,
  getRecommendations,
  issuePartnerToken,
  runLiveScan,
  savePartnerConsent,
  updateSensitivity
} from "@/lib/api";
import { ALLERGY_OPTIONS, JOURNEY_STAGES } from "@/lib/journey";
import { getFitIdSession, markOnboardingCompleted } from "@/lib/auth";
import { measurementsFromProfile, skinToneFromProfile } from "@/lib/avatar-utils";

const AvatarCanvas = dynamic(() => import("@/components/avatar/AvatarCanvas"), { ssr: false });

const CLOTHES = [
  { sku: "FH-112", title: "Formal Dress Shirt", fit_tags: ["formal", "regular"], material_tags: ["cotton"], color_family: "white" },
  { sku: "ZR-009", title: "Relaxed Linen Shirt", fit_tags: ["oversized", "relaxed"], material_tags: ["linen"], color_family: "blue" },
  { sku: "MN-212", title: "Tailored Blazer", fit_tags: ["formal"], material_tags: ["polyester"], color_family: "black" }
];

export default function JourneyPage() {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [fitIdCode, setFitIdCode] = useState<string>("");
  const [partnerToken, setPartnerToken] = useState<string>("");
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [frontPreview, setFrontPreview] = useState<string>("");
  const [sidePreview, setSidePreview] = useState<string>("");
  const [frontCheck, setFrontCheck] = useState<{ ok: boolean; issues: string[] } | null>(null);
  const [sideCheck, setSideCheck] = useState<{ ok: boolean; issues: string[] } | null>(null);
  const [avatarModel, setAvatarModel] = useState<any>(null);
  const scanSeconds = 60;
  const [countdown, setCountdown] = useState<number | null>(null); // 5s photo capture countdown
  const [videoSecondsLeft, setVideoSecondsLeft] = useState<number | null>(null); // 60s scan countdown
  const [videoPhase, setVideoPhase] = useState<"idle" | "front" | "turn" | "side" | "processing">("idle");
  const [scanProfile, setScanProfile] = useState<any>(null);
  const [scanDone, setScanDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const countdownRef = useRef<number | null>(null);
  const autoScanTriggeredRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStopRef = useRef<number | null>(null);
  const frameTimersRef = useRef<number[]>([]);

  const email = useMemo(() => getFitIdSession()?.email ?? "demo@fitid.app", []);

  function nextStep() {
    setStep((prev) => Math.min(prev + 1, JOURNEY_STAGES.length - 1));
  }

  function previousStep() {
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function dataUrlToBlob(dataUrl: string): Blob {
    const [meta, base64] = dataUrl.split(",");
    const mime = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
    const bytes = atob(base64);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) {
      array[i] = bytes.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  }

  const startCamera = useCallback(async (): Promise<MediaStream> => {
    const stream =
      streamRef.current ??
      (await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }));
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    return stream;
  }, []);

  const captureFrame = useCallback((target: "front" | "side") => {
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    if (target === "front") {
      setFrontPreview(dataUrl);
      setFrontCheck(null);
      autoScanTriggeredRef.current = false;
      setStatus("Front image captured. Turn to side and capture again.");
    } else {
      setSidePreview(dataUrl);
      setSideCheck(null);
      autoScanTriggeredRef.current = false;
      setStatus("Side image captured. Ready for AI scan processing.");
    }
  }, []);

  function beginCountdownCapture(target: "front" | "side") {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
    }
    setCountdown(5);
    let seconds = 5;
    countdownRef.current = window.setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);
      if (seconds <= 0) {
        if (countdownRef.current) {
          window.clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setCountdown(null);
        captureFrame(target);
      }
    }, 1000);
  }

  async function handleUploadImage(event: ChangeEvent<HTMLInputElement>, target: "front" | "side") {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
    if (target === "front") {
      setFrontPreview(dataUrl);
      setFrontCheck(null);
      autoScanTriggeredRef.current = false;
      setStatus("Front image uploaded.");
    } else {
      setSidePreview(dataUrl);
      setSideCheck(null);
      autoScanTriggeredRef.current = false;
      setStatus("Side image uploaded.");
    }
    event.target.value = "";
  }

  async function validateSilhouette(dataUrl: string, mode: "front" | "side"): Promise<{ ok: boolean; issues: string[] }> {
    const issues: string[] = [];
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new window.Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Image load failed"));
      im.src = dataUrl;
    });

    const w = 160;
    const h = 240;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, issues: ["Browser cannot analyze this frame."] };
    ctx.drawImage(img, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    // Luma + histogram
    const lum = new Uint8Array(w * h);
    const hist = new Uint32Array(256);
    let sum = 0;
    for (let i = 0; i < w * h; i += 1) {
      const r = data[i * 4 + 0] ?? 0;
      const g = data[i * 4 + 1] ?? 0;
      const b = data[i * 4 + 2] ?? 0;
      const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
      lum[i] = y;
      hist[y] += 1;
      sum += y;
    }
    const mean = sum / (w * h);

    // Otsu threshold (robust to bright walls / dark clothes)
    let total = w * h;
    let sumB = 0;
    let wB = 0;
    let varMax = -1;
    let threshold = 128;
    let sum1 = 0;
    for (let t = 0; t < 256; t += 1) sum1 += t * (hist[t] ?? 0);
    for (let t = 0; t < 256; t += 1) {
      wB += hist[t] ?? 0;
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * (hist[t] ?? 0);
      const mB = sumB / wB;
      const mF = (sum1 - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > varMax) {
        varMax = v;
        threshold = t;
      }
    }

    // Decide foreground polarity by checking center region darkness
    let centerSum = 0;
    let centerN = 0;
    for (let yy = 40; yy < h - 40; yy += 2) {
      for (let xx = Math.floor(w * 0.42); xx < Math.floor(w * 0.58); xx += 2) {
        centerSum += lum[yy * w + xx] ?? 0;
        centerN += 1;
      }
    }
    const centerMean = centerN ? centerSum / centerN : mean;
    const bodyIsDark = centerMean < mean;

    // Build a coarse foreground mask, then derive bbox using row/col occupancy to ignore floor/rug noise.
    const rowCount = new Uint16Array(h);
    const colCount = new Uint16Array(w);
    let fgCount = 0;
    for (let yy = 0; yy < h; yy += 1) {
      let rc = 0;
      for (let xx = 0; xx < w; xx += 1) {
        const v = lum[yy * w + xx] ?? 0;
        const fg = bodyIsDark ? v < threshold : v > threshold;
        if (fg) {
          rc += 1;
          colCount[xx] = (colCount[xx] ?? 0) + 1;
        }
      }
      rowCount[yy] = rc;
      fgCount += rc;
    }

    if (fgCount < w * h * 0.04) {
      return { ok: false, issues: ["Body silhouette not detected — improve lighting and stand against a plain background."] };
    }

    // Find bbox by rows/cols that exceed a small occupancy fraction (filters out thin noise strips).
    // Also ignore the bottom strip (floor/rug) which commonly creates false “cropped feet” detections.
    const rowThresh = Math.max(6, Math.floor(w * 0.065));
    const colThresh = Math.max(8, Math.floor(h * 0.065));
    const ignoreBottom = Math.floor(h * 0.1); // ignore last 10% rows when locating silhouette
    const maxYSearch = h - 1 - ignoreBottom;
    let minY = 0;
    while (minY < maxYSearch && (rowCount[minY] ?? 0) < rowThresh) minY += 1;
    let maxY = maxYSearch;
    while (maxY >= 0 && (rowCount[maxY] ?? 0) < rowThresh) maxY -= 1;
    let minX = 0;
    while (minX < w && (colCount[minX] ?? 0) < colThresh) minX += 1;
    let maxX = w - 1;
    while (maxX >= 0 && (colCount[maxX] ?? 0) < colThresh) maxX -= 1;

    if (maxX <= minX || maxY <= minY) {
      return { ok: false, issues: ["Could not isolate your silhouette — try better lighting and a plain background."] };
    }

    const bw = Math.max(1, maxX - minX + 1);
    const bh = Math.max(1, maxY - minY + 1);
    const hPct = bh / h;
    const wPct = bw / w;
    const margin = Math.round(Math.min(w, h) * 0.008);

    // Edge occupancy (avoid false “cropped” when bbox hits edge due to noise)
    const edgeBand = 3;
    const edgeNeed = 0.055; // fraction of edge pixels that must be foreground to count as real crop
    const edgeOccupancy = (edge: "top" | "bottom" | "left" | "right") => {
      let fg = 0;
      let tot = 0;
      if (edge === "top") {
        for (let yy = 0; yy < edgeBand; yy += 1) for (let xx = 0; xx < w; xx += 1) {
          const v = lum[yy * w + xx] ?? 0;
          const isFg = bodyIsDark ? v < threshold : v > threshold;
          if (isFg) fg += 1;
          tot += 1;
        }
      } else if (edge === "bottom") {
        for (let yy = h - edgeBand; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) {
          const v = lum[yy * w + xx] ?? 0;
          const isFg = bodyIsDark ? v < threshold : v > threshold;
          if (isFg) fg += 1;
          tot += 1;
        }
      } else if (edge === "left") {
        for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < edgeBand; xx += 1) {
          const v = lum[yy * w + xx] ?? 0;
          const isFg = bodyIsDark ? v < threshold : v > threshold;
          if (isFg) fg += 1;
          tot += 1;
        }
      } else {
        for (let yy = 0; yy < h; yy += 1) for (let xx = w - edgeBand; xx < w; xx += 1) {
          const v = lum[yy * w + xx] ?? 0;
          const isFg = bodyIsDark ? v < threshold : v > threshold;
          if (isFg) fg += 1;
          tot += 1;
        }
      }
      return tot ? fg / tot : 0;
    };

    // Full-body in frame (hard-fail only if truly too small)
    if (hPct < 0.46) issues.push("Move closer: your full body is too small in frame.");
    const topEdge = edgeOccupancy("top");
    const bottomEdge = edgeOccupancy("bottom");
    if ((minY <= margin && topEdge > edgeNeed) || (maxY >= maxYSearch - margin && bottomEdge > edgeNeed)) {
      issues.push("Uncrop: keep your head and feet fully visible.");
    }

    // Side-to-side cropping: only warn when actually touching edges.
    const leftEdge = edgeOccupancy("left");
    const rightEdge = edgeOccupancy("right");
    if ((minX <= margin && leftEdge > edgeNeed) || (maxX >= w - 1 - margin && rightEdge > edgeNeed)) {
      issues.push("Uncrop: keep your body fully inside the box.");
    }

    // Arms-out hint: informational only (do not hard-fail good frames).
    if (mode === "front") {
      if (wPct < 0.18) issues.push("If possible, hold arms slightly away from your torso (A/T-pose) for better shoulder accuracy.");
      if (wPct > 0.92) issues.push("Camera too close — step back so your whole body fits.");
    } else {
      if (wPct < 0.12) issues.push("Turn fully sideways and keep your full silhouette visible.");
    }

    // Only block when issues indicate the scan will be unusable.
    const critical = issues.filter((m) => m.startsWith("Body silhouette not detected") || m.startsWith("Could not isolate") || m.startsWith("Move closer"));
    return { ok: critical.length === 0, issues };
  }

  // Validate frames after capture/upload
  useEffect(() => {
    if (step !== 1 || !frontPreview) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      validateSilhouette(frontPreview, "front")
        .then((res) => {
          if (!cancelled) setFrontCheck(res);
        })
        .catch(() => {
          if (!cancelled) setFrontCheck({ ok: false, issues: ["Could not validate frame. Retake the photo."] });
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [frontPreview, step]);

  useEffect(() => {
    if (step !== 1 || !sidePreview) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      validateSilhouette(sidePreview, "side")
        .then((res) => {
          if (!cancelled) setSideCheck(res);
        })
        .catch(() => {
          if (!cancelled) setSideCheck({ ok: false, issues: ["Could not validate frame. Retake the photo."] });
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [sidePreview, step]);

  const handleRunScan = useCallback(async () => {
    setLoading(true);
    setStatus("Running AI scan from captured images...");
    try {
      if (!gender) {
        throw new Error("Select who we are fitting (male or female) before starting the scan.");
      }
      if (!frontPreview || !sidePreview) {
        throw new Error("Please capture both front and side photos.");
      }
      if (frontCheck && !frontCheck.ok) {
        throw new Error("Front frame failed quality checks. Retake the front photo using the guide.");
      }
      if (sideCheck && !sideCheck.ok) {
        throw new Error("Side frame failed quality checks. Retake the side photo using the guide.");
      }
      const profile = await runLiveScan(email, {
        heightCm,
        weightKg,
        frontImage: dataUrlToBlob(frontPreview),
        sideImage: dataUrlToBlob(sidePreview)
      });
      setAvatarModel(profile.body_measurements?.avatar_model ?? null);
      setScanProfile(profile);
      setScanDone(true);
      setStatus("Scan complete. Measurements and body profile captured.");
      nextStep();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scan failed. Ensure backend is running, then retry.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }, [email, frontCheck, frontPreview, gender, heightCm, sideCheck, sidePreview, weightKg]);

  const start60sVideoScan = useCallback(async () => {
    if (loading) return;
    try {
      if (!gender) {
        setStatus("Select male or female first.");
        return;
      }
      setStatus("Starting 60s scan… follow the prompts (front → side).");
      setScanDone(false);
      setScanProfile(null);
      setVideoPhase("front");
      setVideoSecondsLeft(scanSeconds);

      const stream = await startCamera();
      recordChunksRef.current = [];

      // MediaRecorder: best-effort (some browsers may not support the codec; scan still works via frame grabs)
      if (typeof MediaRecorder !== "undefined") {
        try {
          const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
          recorderRef.current = rec;
          rec.ondataavailable = (e) => {
            if (e.data && e.data.size) recordChunksRef.current.push(e.data);
          };
          rec.start(1000);
        } catch {
          recorderRef.current = null;
        }
      }

      // Auto-grab frames from the live video feed.
      frameTimersRef.current.forEach((t) => window.clearTimeout(t));
      frameTimersRef.current = [];
      frameTimersRef.current.push(
        window.setTimeout(() => {
          setVideoPhase("front");
          captureFrame("front");
        }, 9000)
      );
      frameTimersRef.current.push(
        window.setTimeout(() => {
          setVideoPhase("turn");
          setStatus("Turn to your side now. Keep arms slightly away from torso.");
        }, 20000)
      );
      frameTimersRef.current.push(
        window.setTimeout(() => {
          setVideoPhase("side");
          captureFrame("side");
        }, 34000)
      );

      // Countdown tick
      if (recordStopRef.current) window.clearInterval(recordStopRef.current);
      let left = scanSeconds;
      recordStopRef.current = window.setInterval(() => {
        left -= 1;
        setVideoSecondsLeft(left);
        if (left === 45) setStatus("Hold front pose. We’re capturing your frame…");
        if (left === 25) setStatus("Turn to side. We’re capturing your side frame…");
        if (left <= 0) {
          if (recordStopRef.current) {
            window.clearInterval(recordStopRef.current);
            recordStopRef.current = null;
          }
          setVideoSecondsLeft(null);
          setVideoPhase("processing");
          setStatus("Processing scan…");
          try {
            recorderRef.current?.stop();
          } catch {
            // ignore
          }
          window.setTimeout(() => {
            void handleRunScan();
          }, 0);
        }
      }, 1000);
    } catch (e) {
      setVideoPhase("idle");
      setVideoSecondsLeft(null);
      setStatus(e instanceof Error ? e.message : "Camera scan failed to start.");
    }
  }, [captureFrame, gender, handleRunScan, loading, scanSeconds, startCamera]);

  async function handleSensitivity() {
    setLoading(true);
    setStatus("Saving sensitivity profile...");
    try {
      if (!gender) {
        throw new Error("Go back to the scan step and select male or female before continuing.");
      }
      await updateSensitivity(email, {
        allergies: selectedAllergies,
        sensitivities: selectedAllergies,
        fit_preferences: { silhouette: "oversized", formality: "formal", gender }
      });
      setStatus("Sensitivity and fit preferences saved.");
      nextStep();
    } catch {
      setStatus("Could not save sensitivities.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProfile() {
    setLoading(true);
    setStatus("Building your FitID profile...");
    try {
      const data = await fetchProfile(email);
      setProfileData(data);
      const tokenBase = (data.email ?? email).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      setFitIdCode(`FIT-${tokenBase.slice(0, 8).padEnd(8, "X")}`);
      nextStep();
    } catch {
      setStatus("Profile not available yet. Complete previous steps.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePartnerSignIn() {
    setLoading(true);
    setStatus("Connecting FitID to partner store...");
    try {
      await savePartnerConsent(email, "SHEIN", ["body_measurements", "fit_preferences", "allergies"]);
      const tokenResponse = await issuePartnerToken(email, "SHEIN", [
        "body_measurements",
        "fit_preferences",
        "allergies"
      ]);
      setPartnerToken(tokenResponse.fitid_access_token);
      nextStep();
    } catch {
      setStatus("Partner connection failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecommendations() {
    setLoading(true);
    setStatus("Ranking products based on FitID...");
    try {
      const ranked = await getRecommendations(email, CLOTHES);
      setRecommendations(ranked);
    } catch {
      setStatus("Could not load recommendations.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFinishOnboarding() {
    markOnboardingCompleted();
    setStatus("FitID setup complete. Redirecting to dashboard...");
    window.setTimeout(() => {
      window.location.href = "/dashboard";
    }, 900);
  }

  const stageTitle = JOURNEY_STAGES[step];

  useEffect(() => {
    if (step !== 1 || loading || scanDone) return;
    if (!frontPreview || !sidePreview) return;
    if (autoScanTriggeredRef.current) return;
    autoScanTriggeredRef.current = true;
    const t = window.setTimeout(() => {
      setStatus("Both images received. Starting AI scan...");
      void handleRunScan();
    }, 0);
    return () => window.clearTimeout(t);
  }, [frontPreview, sidePreview, step, loading, scanDone, handleRunScan]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      if (recordStopRef.current) window.clearInterval(recordStopRef.current);
      frameTimersRef.current.forEach((t) => window.clearTimeout(t));
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      recorderRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <main className="page-shell fade-in">
      <section className="panel lift">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <p className="badge">FitID Journey</p>
            <h1 className="title" style={{ marginTop: "0.5rem" }}>
              {stageTitle}
            </h1>
            <p className="subtitle">Step {step + 1} of {JOURNEY_STAGES.length}</p>
          </div>
          <Image
            src="/fitid-logo.png"
            alt="FitID logo"
            width={170}
            height={115}
            style={{ width: "auto", height: "auto" }}
            loading="eager"
            priority
          />
        </div>

        <div className="stepper" style={{ marginTop: "1rem" }}>
          {JOURNEY_STAGES.map((label, index) => (
            <div key={label} title={label} className={`step-dot ${index < step ? "done" : ""} ${index === step ? "active" : ""}`}>
              {index + 1}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="grid" style={{ gap: "1rem" }}>
            <p className="subtitle">
              Sign in on the home page using Google. After sign-in, this journey handles scan, profile, partner integration,
              try-on and recommendations.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href="/" className="button secondary">Go to Sign-In Page</Link>
              <button className="button" onClick={nextStep}>Continue</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid">
            <div className="panel lift" style={{ borderRadius: "16px", padding: "1rem", boxShadow: "none" }}>
              <p className="subtitle" style={{ marginBottom: "0.6rem" }}>
                Guided scan: allow camera, capture front and side images, then AI estimates measurements and builds a 3D model profile.
              </p>
              <p className="subtitle" style={{ marginBottom: "0.45rem", fontWeight: 600 }}>Who are we fitting?</p>
              <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setGender("male")}
                  style={{ background: gender === "male" ? "#eef4ff" : "#fff", minWidth: "8rem" }}
                >
                  Male
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setGender("female")}
                  style={{ background: gender === "female" ? "#eef4ff" : "#fff", minWidth: "8rem" }}
                >
                  Female
                </button>
              </div>
              <div className="grid grid-2" style={{ marginBottom: "0.8rem" }}>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span className="subtitle">Height (cm)</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      className="input"
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(Number(e.target.value))}
                      placeholder="Height"
                    />
                    <span className="badge">cm</span>
                  </div>
                </label>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span className="subtitle">Weight (kg)</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      className="input"
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Number(e.target.value))}
                      placeholder="Weight"
                    />
                    <span className="badge">kg</span>
                  </div>
                </label>
              </div>
              <div style={{ position: "relative" }}>
                <video ref={videoRef} style={{ width: "100%", borderRadius: "14px", background: "#0b1020" }} playsInline muted />
                {/* Framing guide overlay */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    borderRadius: 14,
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "18%",
                      right: "18%",
                      top: "6%",
                      bottom: "6%",
                      border: "2px solid rgba(255,255,255,0.65)",
                      borderRadius: 18,
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.18) inset"
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "22%",
                      right: "22%",
                      top: "26%",
                      height: 0,
                      borderTop: "2px dashed rgba(56,189,248,0.75)"
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "22%",
                      right: "22%",
                      top: "52%",
                      height: 0,
                      borderTop: "2px dashed rgba(34,197,94,0.75)"
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "6%",
                      bottom: "6%",
                      width: 0,
                      borderLeft: "2px dashed rgba(255,255,255,0.35)"
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 14,
                      right: 14,
                      bottom: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.85)",
                      textShadow: "0 1px 10px rgba(0,0,0,0.65)"
                    }}
                  >
                    <span>Full body inside box</span>
                    <span>Arms slightly out</span>
                  </div>
                </div>
              </div>
              {countdown !== null && (
                <p style={{ marginTop: "0.65rem", fontWeight: 700 }}>Capturing in {countdown}...</p>
              )}
              {videoSecondsLeft !== null && (
                <div style={{ marginTop: "0.75rem" }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>
                    60s scan running — {videoSecondsLeft}s left
                  </p>
                  <p className="subtitle" style={{ margin: "0.35rem 0 0" }}>
                    {videoPhase === "front"
                      ? "Face the camera (front pose)."
                      : videoPhase === "turn"
                        ? "Turn to your side."
                        : videoPhase === "side"
                          ? "Hold side pose."
                          : "Processing…"}
                  </p>
                </div>
              )}
              <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginTop: "0.8rem" }}>
                <button className="button secondary" onClick={startCamera}>
                  Start Camera
                </button>
                <button className="button secondary" onClick={() => beginCountdownCapture("front")}>
                  Capture Front (5s)
                </button>
                <button className="button secondary" onClick={() => beginCountdownCapture("side")}>
                  Capture Side (5s)
                </button>
              </div>
              <div className="grid grid-2">
                <div>
                  {frontPreview ? (
                    <>
                      <Image src={frontPreview} alt="Front capture" width={420} height={280} unoptimized style={{ width: "100%", height: "auto", borderRadius: "12px", marginTop: "0.8rem" }} />
                      {frontCheck && !frontCheck.ok && (
                        <div className="panel" style={{ marginTop: "0.6rem", borderRadius: 12, boxShadow: "none", border: "1px solid #fecaca" }}>
                          <p style={{ marginTop: 0, fontWeight: 800, color: "#b91c1c" }}>Front frame needs redo</p>
                          <ul className="subtitle" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                            {frontCheck.issues.slice(0, 4).map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {frontCheck && frontCheck.ok && frontCheck.issues.length > 0 && (
                        <div className="panel" style={{ marginTop: "0.6rem", borderRadius: 12, boxShadow: "none", border: "1px solid #bfdbfe" }}>
                          <p style={{ marginTop: 0, fontWeight: 800, color: "#1d4ed8" }}>Front frame looks usable</p>
                          <ul className="subtitle" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                            {frontCheck.issues.slice(0, 3).map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "0.55rem", marginTop: "0.55rem" }}>
                        <button className="button secondary" onClick={() => beginCountdownCapture("front")}>Retake Front</button>
                        <button className="button secondary" onClick={() => { setFrontPreview(""); autoScanTriggeredRef.current = false; }}>Remove</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ marginTop: "0.8rem" }}>
                      <input className="input" value="Front pose not captured" readOnly />
                      <label className="button secondary" style={{ display: "inline-block", marginTop: "0.55rem" }}>
                        Upload Front Image
                        <input type="file" accept="image/*" hidden onChange={(e) => void handleUploadImage(e, "front")} />
                      </label>
                    </div>
                  )}
                </div>
                <div>
                  {sidePreview ? (
                    <>
                      <Image src={sidePreview} alt="Side capture" width={420} height={280} unoptimized style={{ width: "100%", height: "auto", borderRadius: "12px", marginTop: "0.8rem" }} />
                      {sideCheck && !sideCheck.ok && (
                        <div className="panel" style={{ marginTop: "0.6rem", borderRadius: 12, boxShadow: "none", border: "1px solid #fecaca" }}>
                          <p style={{ marginTop: 0, fontWeight: 800, color: "#b91c1c" }}>Side frame needs redo</p>
                          <ul className="subtitle" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                            {sideCheck.issues.slice(0, 4).map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {sideCheck && sideCheck.ok && sideCheck.issues.length > 0 && (
                        <div className="panel" style={{ marginTop: "0.6rem", borderRadius: 12, boxShadow: "none", border: "1px solid #bfdbfe" }}>
                          <p style={{ marginTop: 0, fontWeight: 800, color: "#1d4ed8" }}>Side frame looks usable</p>
                          <ul className="subtitle" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                            {sideCheck.issues.slice(0, 3).map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "0.55rem", marginTop: "0.55rem" }}>
                        <button className="button secondary" onClick={() => beginCountdownCapture("side")}>Retake Side</button>
                        <button className="button secondary" onClick={() => { setSidePreview(""); autoScanTriggeredRef.current = false; }}>Remove</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ marginTop: "0.8rem" }}>
                      <input className="input" value="Side pose not captured" readOnly />
                      <label className="button secondary" style={{ display: "inline-block", marginTop: "0.55rem" }}>
                        Upload Side Image
                        <input type="file" accept="image/*" hidden onChange={(e) => void handleUploadImage(e, "side")} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
                <button
                  className="button"
                  onClick={() => void start60sVideoScan()}
                  disabled={loading || !gender || videoSecondsLeft !== null}
                >
                  {videoSecondsLeft !== null ? "Scan running…" : loading ? "Scanning…" : "Start 60-Second Scan"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void handleRunScan()}
                  disabled={
                    loading ||
                    !gender ||
                    !frontPreview ||
                    !sidePreview ||
                    videoSecondsLeft !== null ||
                    (frontCheck ? !frontCheck.ok : false) ||
                    (sideCheck ? !sideCheck.ok : false)
                  }
                >
                  Run scan from photos
                </button>
              </div>
              <p className="subtitle">
                Scan timer target: {scanSeconds}s. The 60s scan records video and automatically grabs front + side frames to build your 3D avatar.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid">
            <p className="subtitle">
              Your 3D avatar is ready. Drag to rotate and check from all angles — this model stays on your profile for Try On Me.
            </p>
            {scanProfile ? (
              <>
                <AvatarCanvas
                  measurements={measurementsFromProfile(scanProfile.body_measurements)}
                  skinHex={skinToneFromProfile(scanProfile.skin_tone)}
                  garment={null}
                />
                <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "1rem" }}>
                  <button className="button" type="button" onClick={nextStep}>
                    Continue
                  </button>
                  <Link href="/avatar" className="button secondary">
                    Open full avatar page
                  </Link>
                </div>
              </>
            ) : (
              <p className="subtitle">Run the scan first to generate your avatar.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid">
            <p className="subtitle">Select materials you are sensitive to (optional).</p>
            <div className="grid grid-2">
              {ALLERGY_OPTIONS.map((option) => {
                const selected = selectedAllergies.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      setSelectedAllergies((prev) =>
                        prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
                      )
                    }
                    style={{ justifyContent: "flex-start", textAlign: "left", background: selected ? "#eef4ff" : "#fff" }}
                  >
                    {selected ? "✓ " : ""}{option}
                  </button>
                );
              })}
            </div>
            <button className="button" onClick={handleSensitivity} disabled={loading}>
              Continue to FitID Creation
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="grid">
            <p className="subtitle">Generate your digital FitID profile card from captured data.</p>
            <button className="button" onClick={handleCreateProfile} disabled={loading}>
              Create My FitID
            </button>
            {profileData && (
              <section className="panel" style={{ borderRadius: "18px", background: "#10141f", color: "#f7f9ff", boxShadow: "none" }}>
                <p style={{ margin: 0, opacity: 0.8 }}>DIGITAL BODY PASSPORT</p>
                <h2 style={{ marginTop: "0.45rem" }}>{fitIdCode || "FIT-PROFILE"}</h2>
                <p style={{ opacity: 0.86 }}>{profileData.email}</p>
                <p style={{ opacity: 0.9 }}>
                  Chest: {profileData.body_measurements?.chest_cm ?? "-"} cm | Waist: {profileData.body_measurements?.waist_cm ?? "-"} cm | Hips: {profileData.body_measurements?.hip_cm ?? "-"} cm
                </p>
                {avatarModel && <p style={{ opacity: 0.86 }}>3D model scale: shoulders {avatarModel.scale?.shoulders}, torso {avatarModel.scale?.torso}, hips {avatarModel.scale?.hips}</p>}
              </section>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="grid">
            <p className="subtitle">
              Simulate third-party checkout page with &quot;Sign in with FitID&quot; (like Google/Facebook sign-in providers).
            </p>
            <section className="panel" style={{ borderRadius: "16px", boxShadow: "none" }}>
              <p style={{ marginTop: 0, fontWeight: 700 }}>Partner Store Sign-In</p>
              <button className="button secondary" onClick={handlePartnerSignIn} disabled={loading}>
                Sign in with FitID
              </button>
              {partnerToken && <p className="subtitle" style={{ marginTop: "0.7rem" }}>Connected. Token: {partnerToken}</p>}
            </section>
          </div>
        )}

        {step === 6 && (
          <div className="grid">
            <p className="subtitle">Virtual try-on MVP: preview products on your body profile before purchase.</p>
            <div className="grid grid-2">
              {CLOTHES.slice(0, 2).map((item) => (
                <article key={item.sku} className="panel" style={{ borderRadius: "16px", boxShadow: "none" }}>
                  <p style={{ marginTop: 0, fontWeight: 700 }}>{item.title}</p>
                  <p className="subtitle">Fit score preview: 94%</p>
                  <Link
                    className="button secondary"
                    style={{ display: "inline-block", textAlign: "center" }}
                    href={`/try-on?${new URLSearchParams({
                      sku: item.sku,
                      title: item.title,
                      category: item.fit_tags.includes("formal") ? "formal" : "shirts",
                      color: item.color_family
                    }).toString()}`}
                  >
                    View On Me
                  </Link>
                </article>
              ))}
            </div>
            <button className="button" onClick={nextStep}>Continue to Recommendations</button>
          </div>
        )}

        {step === 7 && (
          <div className="grid">
            <p className="subtitle">Ranked feed based on your profile, measurements and sensitivities.</p>
            <button className="button" onClick={handleRecommendations} disabled={loading}>
              Load My Recommendations
            </button>
            {recommendations.length > 0 && (
              <div className="grid grid-2">
                {recommendations.map((item) => (
                  <article key={item.sku} className="panel" style={{ borderRadius: "16px", boxShadow: "none" }}>
                    <p style={{ marginTop: 0, fontWeight: 700 }}>{item.title}</p>
                    <p className="subtitle">Fit Score: {item.score}%</p>
                    <p className="subtitle">Size: {item.recommended_size}</p>
                    <p className="badge">{item.reason}</p>
                  </article>
                ))}
              </div>
            )}
            <button className="button" disabled={!scanDone || recommendations.length === 0} onClick={handleFinishOnboarding}>
              Finish Account Setup
            </button>
          </div>
        )}

        {status && <p className="subtitle" style={{ marginTop: "1rem" }}>{status}</p>}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "1rem", gap: "0.75rem" }}>
          <button className="button secondary" onClick={previousStep} disabled={step === 0}>
            Back
          </button>
          <span className="badge" style={{ textAlign: "center" }}>Complete all steps to finish account setup.</span>
        </div>
      </section>
    </main>
  );
}
