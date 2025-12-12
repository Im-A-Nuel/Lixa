"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { ipfsHttpGateways } from "@/lib/ipfs";

type AssetMediaProps = {
  src?: string;
  alt?: string;
  mimeType?: string;
  filename?: string;
  className?: string;
  interactive?: boolean;
};

const MODEL_EXTS = ["gltf", "glb", "fbx", "obj", "stl", "ply"];

function looksLikeModel(mimeType?: string, filename?: string) {
  if (mimeType && mimeType.toLowerCase().startsWith("model/")) return true;
  if (mimeType && mimeType.toLowerCase().includes("gltf")) return true;
  if (mimeType && mimeType.toLowerCase() === "application/octet-stream" && filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext && MODEL_EXTS.includes(ext)) return true;
  }
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext && MODEL_EXTS.includes(ext)) return true;
  }
  return false;
}

// Allow <model-viewer /> intrinsic element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        "camera-controls"?: boolean;
        "touch-action"?: string;
        "auto-rotate"?: boolean;
        autoplay?: boolean;
        exposure?: string | number;
        poster?: string;
        loading?: string;
        reveal?: string;
        ar?: boolean;
      };
    }
  }
}

export function AssetMedia({ src, alt, mimeType, filename, className, interactive = false }: AssetMediaProps) {
  const isModel = looksLikeModel(mimeType, filename);
  const [shouldLoadModel, setShouldLoadModel] = useState(interactive);
  const [modelScreenshot, setModelScreenshot] = useState<string | null>(null);

  // For 3D models, use our proxy API to avoid CORS issues
  // For images, try proxy as fallback after direct gateways
  const candidates = useMemo(() => {
    if (!src || src.trim() === '') return [];

    // Validate IPFS source format
    if (src.startsWith("ipfs://")) {
      const cid = src.replace("ipfs://", "").trim();
      if (!cid || cid.length < 10) {
        // Invalid or too short CID
        if (process.env.NODE_ENV === 'development') {
          console.warn("[AssetMedia] Invalid IPFS CID:", src);
        }
        return [];
      }

      if (isModel) {
        // Models need proxy first due to CORS
        return [`/api/proxy-ipfs?cid=${cid}`];
      } else {
        // Images: try gateways first, then proxy as fallback
        return [...ipfsHttpGateways(src), `/api/proxy-ipfs?cid=${cid}`];
      }
    }
    return ipfsHttpGateways(src);
  }, [src, isModel]);

  const [srcIndex, setSrcIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const currentSrc = candidates[srcIndex] || src || "";
  const modelViewerRef = useRef<HTMLElement>(null);

  // Set failed state if no valid candidates (invalid src)
  useEffect(() => {
    if (src && candidates.length === 0 && !failed) {
      setFailed(true);
    }
  }, [src, candidates.length, failed]);

  const handleError = (e?: any) => {
    setSrcIndex((prev) => {
      const next = prev + 1;
      if (next < candidates.length) {
        // Only log as warning when trying fallbacks (not an error, this is expected)
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Gateway failed, trying fallback #${next}/${candidates.length}`, currentSrc);
        }
        return next;
      }
      // Only log warning when ALL gateways have failed (not error, as this may be expected for some assets)
      if (process.env.NODE_ENV === 'development' && src && candidates.length > 0) {
        console.warn("All IPFS gateways failed to load asset", { src, tried: candidates.length });
      }
      setFailed(true);
      return prev;
    });
  };

  const handleLoaded = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log("AssetMedia loaded successfully", { src: currentSrc });
    }
    setIsLoaded(true);
  };

  // Ensure <model-viewer> is defined even if the global script fails to load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (customElements.get("model-viewer")) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js";
    script.onload = () => console.log("[AssetMedia] model-viewer script loaded");
    script.onerror = () => console.error("[AssetMedia] model-viewer script failed to load");
    document.head.appendChild(script);
    return () => {
      if (!customElements.get("model-viewer") && script.parentElement) {
        script.parentElement.removeChild(script);
      }
    };
  }, []);

  // If the current gateway hangs without firing onError, fallback after a timeout.
  useEffect(() => {
    if (!isModel || isLoaded || failed) return;
    if (srcIndex >= candidates.length - 1) return;
    const timer = setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        console.warn("AssetMedia load timeout, switching gateway", { src: currentSrc });
      }
      handleError();
    }, 45000); // Increased timeout for large 3D models (45s)
    return () => clearTimeout(timer);
  }, [isModel, isLoaded, failed, srcIndex, candidates.length, currentSrc]);

  // Listen for model-viewer events and capture screenshot for preview
  useEffect(() => {
    if (!isModel || typeof window === "undefined" || !modelViewerRef.current) return;

    const viewer = modelViewerRef.current;

    const onModelLoad = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log("[model-viewer] Model loaded successfully");
      }

      // Capture screenshot after model loads (only if not already captured)
      if (!modelScreenshot) {
        setTimeout(() => {
          try {
            const canvas = (viewer as any).getCanvas?.();
            if (canvas) {
              const screenshot = canvas.toDataURL("image/png");
              setModelScreenshot(screenshot);
              if (process.env.NODE_ENV === 'development') {
                console.log("[model-viewer] Screenshot captured");
              }
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn("[model-viewer] Failed to capture screenshot:", error);
            }
          }
        }, 500);
      }

      handleLoaded();
    };

    const onModelError = (event: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn("[model-viewer] Error loading model:", event.detail || event);
      }
      handleError(event);
    };

    const onProgress = (event: any) => {
      if (process.env.NODE_ENV === 'development' && event.detail && event.detail.totalProgress !== undefined) {
        const progress = (event.detail.totalProgress * 100).toFixed(1);
        console.log(`[model-viewer] Loading progress: ${progress}%`);
      }
    };

    viewer.addEventListener("load", onModelLoad);
    viewer.addEventListener("error", onModelError);
    viewer.addEventListener("progress", onProgress);

    if (process.env.NODE_ENV === 'development') {
      console.log("[model-viewer] Event listeners attached, loading from:", currentSrc);
    }

    return () => {
      viewer.removeEventListener("load", onModelLoad);
      viewer.removeEventListener("error", onModelError);
      viewer.removeEventListener("progress", onProgress);
    };
  }, [isModel, currentSrc, modelViewerRef.current]);

  // Early return AFTER all hooks are called
  if (!src) return null;

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-600">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 5h12M9 3v2m6 14H3a2 2 0 01-2-2V7a2 2 0 012-2h0l4-2h4l4 2h0a2 2 0 012 2v6"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 11l1.5 2 2-3 3.5 6h-12l3-5 2 3z" />
        </svg>
      </div>
    );
  }

  if (isModel) {
    // Non-interactive mode: show static preview after screenshot is ready
    if (!interactive) {
      // If screenshot is ready, show it
      if (modelScreenshot) {
        return (
          <img
            src={modelScreenshot}
            alt={alt || "3D model preview"}
            className={className || "w-full h-full object-cover"}
          />
        );
      }

      // If loading failed, show placeholder
      if (failed) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-600">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <p className="text-xs">3D Model</p>
            </div>
          </div>
        );
      }

      // Still loading screenshot - show model viewer visible to capture screenshot
      return (
        <div className="relative w-full h-full bg-gray-950">
          <model-viewer
            ref={modelViewerRef}
            src={currentSrc}
            alt={alt || "3D model"}
            camera-controls={false}
            auto-rotate={false}
            loading="eager"
            ar={false}
            style={{
              width: "100%",
              height: "100%",
              background: "#1a1a1a"
            }}
          />
        </div>
      );
    }

    // Interactive mode: show 3D model viewer
    return (
      <div className="relative w-full h-full bg-gray-950">
        <model-viewer
          ref={modelViewerRef}
          src={currentSrc}
          alt={alt || "3D model"}
          camera-controls={true}
          touch-action="pan-y"
          auto-rotate={false}
          loading="eager"
          reveal="auto"
          ar={false}
          poster="data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='32' height='32' rx='4' fill='%2321273a'/%3E%3C/svg%3E"
          style={{
            width: "100%",
            height: "100%",
            background: "#1a1a1a"
          }}
        />
        {!isLoaded && !failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-gray-500 gap-2 bg-gray-950">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <div className="mt-2">Loading 3D model...</div>
            <div className="text-xs text-gray-600 break-all px-4 text-center max-w-md">
              {currentSrc.includes('/api/proxy-ipfs')
                ? 'Fetching from IPFS via proxy...'
                : `Source: ${currentSrc}`}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt || "Asset"}
      className={className || "w-full h-full object-cover"}
      onError={handleError}
      onLoad={handleLoaded}
    />
  );
}
