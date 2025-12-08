"use client";

import { useCallback, useState, useRef, useEffect } from "react";

type FileType = "image" | "audio" | "video" | "model" | "unknown";

interface FileUploadProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSize?: number; // in MB
}

const MODEL_EXTENSIONS = ["glb", "gltf", "fbx", "obj", "stl", "ply"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "flac", "aac"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "mkv"];

function getFileType(file: File): FileType {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const mimeType = file.type.toLowerCase();

  if (mimeType.startsWith("image/") || IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (mimeType.startsWith("audio/") || AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (mimeType.startsWith("video/") || VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (mimeType.startsWith("model/") || mimeType.includes("gltf") || MODEL_EXTENSIONS.includes(ext)) return "model";

  return "unknown";
}

function getFileTypeIcon(type: FileType) {
  switch (type) {
    case "image":
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "audio":
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    case "video":
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case "model":
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    default:
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Declare model-viewer for TypeScript
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

export function FileUpload({ file, onFileSelect, accept, maxSize = 50 }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const fileType = file ? getFileType(file) : null;

  // Create preview URL when file changes
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  // Load model-viewer script for 3D models
  useEffect(() => {
    if (fileType === "model" && typeof window !== "undefined") {
      if (!customElements.get("model-viewer")) {
        const script = document.createElement("script");
        script.type = "module";
        script.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js";
        document.head.appendChild(script);
      }
    }
  }, [fileType]);

  const handleFileValidation = useCallback((selectedFile: File): boolean => {
    setError(null);

    // Check file size
    const maxBytes = maxSize * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setError(`File size exceeds ${maxSize}MB limit`);
      return false;
    }

    return true;
  }, [maxSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && handleFileValidation(droppedFile)) {
      onFileSelect(droppedFile);
    }
  }, [handleFileValidation, onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && handleFileValidation(selectedFile)) {
      onFileSelect(selectedFile);
    }
  }, [handleFileValidation, onFileSelect]);

  const handleRemove = useCallback(() => {
    onFileSelect(null);
    setError(null);
    setIsPlaying(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onFileSelect]);

  const toggleAudio = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Render preview based on file type
  const renderPreview = () => {
    if (!file || !previewUrl) return null;

    switch (fileType) {
      case "image":
        return (
          <div className="relative w-full h-64 rounded-lg overflow-hidden bg-gray-900">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </div>
        );

      case "audio":
        return (
          <div className="relative w-full bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-lg p-6">
            <div className="flex items-center gap-4">
              {/* Audio visualization placeholder */}
              <button
                onClick={toggleAudio}
                className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <span className="text-sm text-gray-300 truncate">{file.name}</span>
                </div>
                {/* Audio waveform visualization */}
                <div className="flex items-center gap-0.5 h-8">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 bg-purple-500/60 rounded-full transition-all ${isPlaying ? "animate-pulse" : ""}`}
                      style={{
                        height: `${Math.random() * 100}%`,
                        animationDelay: `${i * 50}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <audio
              ref={audioRef}
              src={previewUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>
        );

      case "video":
        return (
          <div className="relative w-full h-64 rounded-lg overflow-hidden bg-gray-900">
            <video
              src={previewUrl}
              controls
              className="w-full h-full object-contain"
            />
          </div>
        );

      case "model":
        return (
          <div className="relative w-full h-72 rounded-lg overflow-hidden bg-gray-900">
            <model-viewer
              src={previewUrl}
              alt="3D Model Preview"
              camera-controls={true}
              auto-rotate={true}
              touch-action="pan-y"
              loading="eager"
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
              }}
            />
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-gray-300 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              3D Model - Drag to rotate
            </div>
          </div>
        );

      default:
        return (
          <div className="w-full h-32 rounded-lg bg-gray-900 flex items-center justify-center">
            <div className="text-center text-gray-400">
              {getFileTypeIcon("unknown")}
              <p className="mt-2 text-sm">File preview not available</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
            ${isDragging
              ? "border-purple-500 bg-purple-500/10"
              : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept || "image/*,audio/*,video/*,.glb,.gltf,.fbx,.obj,.stl,.ply"}
            onChange={handleInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-4">
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center transition-colors
              ${isDragging ? "bg-purple-500/20 text-purple-400" : "bg-gray-800 text-gray-400"}
            `}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <div>
              <p className="text-gray-300 font-medium">
                {isDragging ? "Drop your file here" : "Drag & drop your asset file"}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                or click to browse
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 flex items-center gap-1">
                {getFileTypeIcon("image")}
                Images
              </span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 flex items-center gap-1">
                {getFileTypeIcon("model")}
                3D Models
              </span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 flex items-center gap-1">
                {getFileTypeIcon("audio")}
                Audio
              </span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 flex items-center gap-1">
                {getFileTypeIcon("video")}
                Video
              </span>
            </div>

            <p className="text-gray-600 text-xs">
              Max file size: {maxSize}MB
            </p>
          </div>
        </div>
      ) : (
        /* File selected - show preview */
        <div className="space-y-4">
          {renderPreview()}

          {/* File info bar */}
          <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                ${fileType === "image" ? "bg-blue-500/20 text-blue-400" :
                  fileType === "audio" ? "bg-purple-500/20 text-purple-400" :
                  fileType === "video" ? "bg-red-500/20 text-red-400" :
                  fileType === "model" ? "bg-green-500/20 text-green-400" :
                  "bg-gray-700 text-gray-400"}
              `}>
                {getFileTypeIcon(fileType || "unknown")}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-200 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.size)} • {fileType?.toUpperCase() || "FILE"}
                </p>
              </div>
            </div>

            <button
              onClick={handleRemove}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-red-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
