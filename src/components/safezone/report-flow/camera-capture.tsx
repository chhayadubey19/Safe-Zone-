"use client";

/**
 * Step 1 — camera capture card.
 *
 * The <video> element is ALWAYS rendered visible (never display:none) while
 * the camera is starting or live, with autoPlay + playsInline + muted and
 * object-cover inside a defined aspect box. The capture button stays gated
 * until the video reports 'loadeddata' AND readyState >= 2, and every captured
 * frame passes a black-frame guard before the still preview ("Retake" /
 * "Use photo") is shown — the citizen always SEES the actual photo first.
 *
 * If getUserMedia throws / is denied / unsupported, a "Capture via camera app"
 * fallback (<input type="file" accept="image/*" capture="environment">) keeps
 * the flow working; the picked photo continues from the same preview step.
 *
 * Geolocation and the capture timestamp are captured automatically by the
 * parent page and shown here as passive metadata chips; an unavailable
 * location never blocks submission.
 */

import { useEffect, useRef, useState } from "react";
import {
  Camera, CameraOff, CheckCircle2, Clock, Loader2, MapPin, RefreshCw, Smartphone, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  prepareCanvasImage,
  prepareImageFromFile,
  type PreparedImage,
} from "@/lib/image-prepare";

export interface GeoState {
  status: "pending" | "ok" | "denied" | "unsupported";
  lat: number | null;
  lng: number | null;
}

type CameraState = "idle" | "starting" | "live" | "preview" | "error";

/** Black-frame guard shared by both capture paths — an all-black capture
 *  means the camera never produced a real frame and must be retaken. */
function isBlackFrame(prepared: PreparedImage): boolean {
  return prepared.luminance !== null && prepared.luminance < 5;
}

export function CameraCaptureCard({
  photo,
  onPhotoChange,
  geo,
  capturedAt,
  onCapturedAtChange,
}: {
  photo: string | null;
  onPhotoChange: (photo: string | null) => void;
  geo: GeoState;
  capturedAt: string | null;
  onCapturedAtChange: (iso: string | null) => void;
}) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  /** True once 'loadeddata' fired AND video.readyState >= 2 — frames are real. */
  const [videoReady, setVideoReady] = useState(false);
  /** The captured/selected still awaiting the citizen's "Use photo" confirmation. */
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingCapturedAt, setPendingCapturedAt] = useState<string | null>(null);
  /** True when the current pending photo came from the camera-app fallback. */
  const [fallbackUsed, setFallbackUsed] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Release the camera when leaving the card / unmounting.
  useEffect(() => () => stopStream(), []);

  // Attach the stream to the <video> whenever it exists AND a stream has been
  // acquired. This is the black-screen fix: the video element mounts BEFORE
  // the stream arrives (during "starting"), and this effect re-runs on every
  // state transition so srcObject is always set on the live element.
  useEffect(() => {
    if (cameraState !== "starting" && cameraState !== "live") return;
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    if (video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
    }
    void video.play().catch(() => undefined);
  }, [cameraState, videoReady]);

  // Safety net: if the element already has frames (e.g. cached stream),
  // mark it ready without waiting for another event.
  useEffect(() => {
    if (cameraState === "live" && !videoReady && (videoRef.current?.readyState ?? 0) >= 2) {
      setVideoReady(true);
    }
  }, [cameraState, videoReady]);

  const openCamera = async () => {
    setCameraError(null);
    setVideoReady(false);
    setCameraState("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("unsupported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraState("live");
      // srcObject is attached by the effect above once the <video> mounts.
    } catch (err) {
      stopStream();
      setCameraState("error");
      const name = err instanceof DOMException ? err.name : "";
      setCameraError(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access, use the camera-app option below, or continue with a text-only report."
          : name === "NotFoundError"
            ? "No camera found on this device. You can capture via the camera app, or continue with a text-only report."
            : "Live camera unavailable on this device. You can capture via the camera app, or continue with a text-only report.",
      );
    }
  };

  const handleVideoReady = () => {
    if ((videoRef.current?.readyState ?? 0) >= 2) setVideoReady(true);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.readyState < 2) {
      // No frame produced — the video element has nothing real to draw yet.
      toast({
        title: "Camera not ready",
        description: "The camera is still starting up — try again in a moment.",
      });
      return;
    }

    // Canvas at the video's intrinsic resolution — exactly what the camera
    // sees — then downscaled + byte-bounded by the shared image pipeline
    // (mobile serverless request-body limits are the reason: an unbounded
    // frame can exceed the platform's ~4.5 MB cap before the route runs).
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const prepared = prepareCanvasImage(canvas);
    if (!prepared) {
      toast({ title: "Could not read the frame", description: "Please try again." });
      return;
    }
    if (isBlackFrame(prepared)) {
      toast({
        title: "Captured frame is black — please retake",
        description: "No image detail was captured. Point the camera at the issue and try again.",
        variant: "destructive",
      });
      return;
    }

    stopStream();
    setPendingPhoto(prepared.dataUrl);
    setPendingCapturedAt(new Date().toISOString());
    setFallbackUsed(false);
    setVideoReady(false);
    setCameraState("preview");
  };

  const onFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      toast({ title: "Not a photo", description: "Please choose an image from the camera." });
      return;
    }
    // Shared pipeline: EXIF-oriented, downscaled, byte-bounded JPEG — camera
    // apps commonly hand back 6–12 MP originals that would blow past the
    // serverless request-body cap unprocessed.
    const out = await prepareImageFromFile(file);
    if (!out) {
      toast({ title: "Could not read the photo", description: "Please try a different image." });
      return;
    }
    if (isBlackFrame(out)) {
      toast({
        title: "Captured frame is black — please retake",
        description: "No image detail was captured. Point the camera at the issue and try again.",
        variant: "destructive",
      });
      return;
    }
    setFallbackUsed(true);
    setPendingPhoto(out.dataUrl);
    setPendingCapturedAt(new Date().toISOString());
    setCameraState("preview"); // same preview step as a live capture
  };

  const retake = () => {
    setPendingPhoto(null);
    setPendingCapturedAt(null);
    if (fallbackUsed) {
      setCameraState("error"); // back to the fallback picker (getUserMedia is unavailable)
      fileInputRef.current?.click();
    } else {
      void openCamera();
    }
  };

  const usePhoto = () => {
    if (!pendingPhoto) return;
    onPhotoChange(pendingPhoto);
    onCapturedAtChange(pendingCapturedAt ?? new Date().toISOString());
    setPendingPhoto(null);
    setPendingCapturedAt(null);
    setCameraState("idle");
  };

  const removePhoto = () => {
    onPhotoChange(null);
    onCapturedAtChange(null);
    setFallbackUsed(false);
    setCameraState("idle");
  };

  const showVideo = cameraState === "starting" || cameraState === "live";
  const showCommitted = Boolean(photo) && cameraState === "idle";
  const showIdle = !photo && cameraState === "idle";

  return (
    <section className="rounded-xl border border-edge bg-surface shadow-card" aria-label="Photo evidence">
      <div className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Camera className="h-4 w-4 text-navy" aria-hidden />
          Photo evidence <span className="font-normal text-ink-muted">(optional)</span>
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Rear camera · live capture
        </span>
      </div>

      {/* Hidden camera-app fallback input (used only when getUserMedia is unavailable) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFallbackFile(e)}
        aria-hidden
        tabIndex={-1}
      />

      <div className="space-y-3 p-4">
        {/* Live viewfinder — the video element is rendered VISIBLE (autoPlay,
            playsInline, muted, object-cover in a defined aspect box) from the
            moment the camera starts, and stays mounted until capture. */}
        {showVideo && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-edge bg-ink">
              { }
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] w-full object-cover"
                aria-label="Live camera preview"
                onLoadedData={handleVideoReady}
                onCanPlay={handleVideoReady}
              />
              {!videoReady && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/60 text-white">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                  <span className="text-sm font-medium">Starting camera…</span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-3 rounded-lg border-2 border-white/40" />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={capture}
                disabled={!videoReady}
                className="h-12 flex-1 gap-2 rounded-xl bg-navy font-semibold text-white hover:bg-navy-hover"
              >
                <Camera className="h-4 w-4" aria-hidden />
                {videoReady ? "Capture photo" : "Starting camera…"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  stopStream();
                  setVideoReady(false);
                  setCameraState("idle");
                }}
                className="h-12 rounded-xl border-edge"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Still preview — the citizen must SEE the actual photo before continuing */}
        {cameraState === "preview" && pendingPhoto && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-edge">
              {/* Photo is a locally-captured camera frame, not remote content. */}
              { }
              <img src={pendingPhoto} alt="Captured evidence preview" className="aspect-[4/3] w-full object-cover" />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-white">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> Captured
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={retake}
                className="h-12 flex-1 gap-2 rounded-xl border-edge"
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Retake
              </Button>
              <Button
                onClick={usePhoto}
                className="h-12 flex-1 gap-2 rounded-xl bg-navy font-semibold text-white shadow-card hover:bg-navy-hover"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Use photo
              </Button>
            </div>
          </div>
        )}

        {/* Committed photo */}
        {showCommitted && photo && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-edge">
              {/* Photo is a locally-captured camera frame, not remote content. */}
              { }
              <img src={photo} alt="Captured evidence" className="aspect-[4/3] w-full object-cover" />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-white">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> Captured
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFallbackUsed(false);
                  void openCamera();
                }}
                className="h-12 flex-1 gap-2 rounded-xl border-edge"
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Retake
              </Button>
              <Button
                variant="outline"
                onClick={removePhoto}
                className="h-12 gap-2 rounded-xl border-edge text-risk-urgent hover:text-risk-urgent"
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </Button>
            </div>
          </div>
        )}

        {/* Error — live camera unavailable; the camera-app fallback keeps the flow alive */}
        {cameraState === "error" && (
          <div className="space-y-3">
            <div className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-risk-urgent/40 bg-risk-urgent-soft/40 px-4 py-6 text-sm">
              <CameraOff className="h-6 w-6 text-risk-urgent" aria-hidden />
              <span className="font-medium text-ink">Camera unavailable</span>
              <span className="max-w-xs text-center text-xs text-ink-muted">
                {cameraError ?? "Live camera unavailable on this device."}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => void openCamera()}
                className="h-12 gap-2 rounded-xl border-edge"
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Try again
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="h-12 gap-2 rounded-xl bg-navy font-semibold text-white hover:bg-navy-hover"
              >
                <Smartphone className="h-4 w-4" aria-hidden /> Capture via camera app
              </Button>
            </div>
          </div>
        )}

        {/* Idle — open the camera */}
        {showIdle && (
          <button
            type="button"
            onClick={() => void openCamera()}
            className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-trust-unverified bg-canvas px-4 py-6 text-sm transition-colors hover:border-navy/40"
          >
            <Camera className="h-6 w-6 text-navy" aria-hidden />
            <span className="font-medium text-ink">Open camera to capture evidence</span>
            <span className="max-w-xs text-center text-xs text-ink-muted">
              Live capture with the rear camera. Location and time are attached automatically.
            </span>
          </button>
        )}

        {/* Automatic metadata chips — an unavailable location never blocks submission */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              geo.status === "ok"
                ? "bg-trust-verified-soft text-green-800"
                : "bg-canvas text-slate-500 border border-dashed border-trust-unverified",
            )}
            title={
              geo.status === "ok"
                ? `Captured automatically: ${geo.lat?.toFixed(5)}, ${geo.lng?.toFixed(5)}`
                : "Geolocation unavailable — the venue's coordinates will be used"
            }
          >
            <MapPin className="h-3 w-3" aria-hidden />
            {geo.status === "pending"
              ? "Locating…"
              : geo.status === "ok"
                ? "Location captured"
                : "Location unavailable"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-trust-unverified bg-canvas px-2 py-0.5 text-[11px] font-medium text-slate-500">
            <Clock className="h-3 w-3" aria-hidden />
            {capturedAt
              ? `Captured ${new Date(capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Timestamp auto-attached"}
          </span>
        </div>
      </div>
    </section>
  );
}
