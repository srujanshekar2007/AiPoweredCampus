"use client";

import { useEffect, useRef, useState } from "react";

export default function IssueCameraCapture({ onCapture }: { onCapture: (file: File) => void }) {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is unavailable in this browser. Use the photo upload option instead.");
        return;
      }
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          activeStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setStream(activeStream);
        setError("");
      } catch (cause) {
        if (cancelled) return;
        const name = cause instanceof DOMException ? cause.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("Camera access was blocked. Allow camera access in your browser settings, then try again.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("No usable camera was found. Use the photo upload option instead.");
        } else if (name === "NotReadableError" || name === "AbortError") {
          setError("The camera is busy in another app. Close that app and try again.");
        } else {
          setError("The camera could not be opened. Check browser permissions or upload a photo instead.");
        }
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      activeStream?.getTracks().forEach((track) => track.stop());
    };
  }, [open]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => setError("Camera preview could not start. Try closing and reopening the camera."));
    }
  }, [stream]);

  const close = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setOpen(false);
    setError("");
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Wait for the camera preview to appear, then take the photo.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture the photo. Please try again or upload an image.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Could not create the photo. Please try again.");
        return;
      }
      onCapture(new File([blob], `campus-issue-${Date.now()}.jpg`, { type: "image/jpeg" }));
      close();
    }, "image/jpeg", 0.9);
  };

  return (
    <>
      <button type="button" className="button button-primary camera-open-button" onClick={() => { setError(""); setOpen(true); }}>
        <span aria-hidden="true">◎</span> Capture a photo with camera
      </button>
      {open && (
        <div className="camera-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-dialog-title">
            <div className="camera-dialog-heading">
              <div><p className="eyebrow">ISSUE PHOTO</p><h2 id="camera-dialog-title">Capture a photo</h2></div>
              <button type="button" className="icon-button" aria-label="Close camera" onClick={close}>×</button>
            </div>
            {stream ? <video ref={videoRef} className="camera-preview" autoPlay playsInline muted aria-label="Live camera preview" /> : <div className="camera-preview camera-preview-empty" aria-live="polite">{error || "Requesting camera access…"}</div>}
            {error && <p className="camera-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="button button-outline" onClick={close}>Cancel</button>
              <button type="button" className="button button-primary" onClick={capture} disabled={!stream}>Take photo</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
