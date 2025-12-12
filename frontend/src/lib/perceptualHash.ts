/**
 * Perceptual Hashing Utilities for Near-Duplicate Detection
 *
 * This module provides functions to compute perceptual hashes for different media types:
 * - Images: pHash (perceptual hash), dHash (difference hash)
 * - Audio: Chromaprint fingerprinting (placeholder for future implementation)
 * - 3D Models: Geometric signatures (placeholder for future implementation)
 *
 * These hashes are robust to minor modifications (compression, resizing, metadata changes)
 * and allow detection of near-duplicates using Hamming distance.
 */

/**
 * Calculate Hamming distance between two hex strings
 * Used to compare perceptual hashes - lower distance = more similar
 * Threshold recommendation: <= 10 for images (pHash), adjust based on testing
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error("Hash lengths must be equal");
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
    // Count set bits in XOR result
    distance += xor.toString(2).split('1').length - 1;
  }
  return distance;
}

/**
 * Check if two perceptual hashes are similar based on Hamming distance
 * @param hash1 First perceptual hash (hex string)
 * @param hash2 Second perceptual hash (hex string)
 * @param threshold Maximum Hamming distance to consider similar (default: 10 for images)
 * @returns true if hashes are similar (distance <= threshold)
 */
export function areSimilarHashes(
  hash1: string,
  hash2: string,
  threshold: number = 10
): boolean {
  try {
    const distance = hammingDistance(hash1, hash2);
    return distance <= threshold;
  } catch {
    return false;
  }
}

/**
 * Compute difference hash (dHash) for images
 * This is a simple client-side implementation using Canvas API
 *
 * Algorithm:
 * 1. Resize image to 9x8 (grayscale)
 * 2. Compare adjacent pixels horizontally
 * 3. Generate 64-bit hash based on comparison results
 *
 * @param imageFile File or Blob containing image
 * @returns Promise<string> Hex string representing the dHash
 */
export async function computeImageDHash(imageFile: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      try {
        // Resize to 9x8 for dHash
        const width = 9;
        const height = 8;
        canvas.width = width;
        canvas.height = height;

        // Draw and get grayscale pixels
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        // Convert to grayscale and compute hash
        const gray: number[] = [];
        for (let i = 0; i < pixels.length; i += 4) {
          // Grayscale: (R + G + B) / 3
          const grayscale = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          gray.push(grayscale);
        }

        // Compute dHash: compare adjacent horizontal pixels
        let hash = '';
        for (let row = 0; row < height; row++) {
          for (let col = 0; col < width - 1; col++) {
            const idx = row * width + col;
            const left = gray[idx];
            const right = gray[idx + 1];
            hash += left < right ? '1' : '0';
          }
        }

        // Convert binary string to hex
        const hexHash = parseInt(hash, 2).toString(16).padStart(16, '0');
        resolve(hexHash);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Create object URL from File/Blob
    const url = URL.createObjectURL(imageFile);
    img.src = url;
  });
}

/**
 * Compute average hash (aHash) for images
 * Simpler and faster than pHash, good for basic similarity detection
 *
 * Algorithm:
 * 1. Resize to 8x8 grayscale
 * 2. Calculate average pixel value
 * 3. Generate 64-bit hash: 1 if pixel > average, 0 otherwise
 */
export async function computeImageAHash(imageFile: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      try {
        // Resize to 8x8 for aHash
        const size = 8;
        canvas.width = size;
        canvas.height = size;

        // Draw and get grayscale pixels
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        // Convert to grayscale
        const gray: number[] = [];
        for (let i = 0; i < pixels.length; i += 4) {
          const grayscale = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          gray.push(grayscale);
        }

        // Calculate average
        const average = gray.reduce((a, b) => a + b, 0) / gray.length;

        // Generate hash: 1 if pixel > average, 0 otherwise
        let hash = '';
        for (const pixel of gray) {
          hash += pixel > average ? '1' : '0';
        }

        // Convert to hex
        const hexHash = parseInt(hash, 2).toString(16).padStart(16, '0');
        resolve(hexHash);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    const url = URL.createObjectURL(imageFile);
    img.src = url;
  });
}

/**
 * Placeholder for audio fingerprinting using Chromaprint/AcoustID
 * This would require server-side implementation with ffmpeg + fpcalc
 *
 * Implementation steps (server-side):
 * 1. Decode audio to PCM WAV (44.1kHz mono) using ffmpeg
 * 2. Run fpcalc (Chromaprint) to generate fingerprint
 * 3. Store fingerprint in database
 * 4. Compare using AcoustID matching or custom similarity
 *
 * @param audioFile Audio file
 * @returns Promise<string> Chromaprint fingerprint
 */
export async function computeAudioFingerprint(audioFile: File): Promise<string> {
  // TODO: Implement server-side audio fingerprinting
  // This requires: ffmpeg, fpcalc/chromaprint
  throw new Error('Audio fingerprinting not yet implemented - requires server-side processing');
}

/**
 * Placeholder for 3D model geometric hashing
 * This would require server-side implementation with Blender/trimesh
 *
 * Implementation steps (server-side):
 * 1. Load 3D model using Blender/trimesh/Open3D
 * 2. Normalize: scale to unit bounding box, align orientation
 * 3. Compute geometric descriptors:
 *    - ShapeDNA (eigenvalues of Laplacian)
 *    - Spherical harmonic descriptors
 *    - ML embeddings (PointNet, DGCNN)
 * 4. Hash or store as vector for similarity search (FAISS/Milvus)
 *
 * @param modelFile 3D model file
 * @returns Promise<string> Geometric hash or descriptor
 */
export async function compute3DModelHash(modelFile: File): Promise<string> {
  // TODO: Implement server-side 3D model hashing
  // This requires: Blender, trimesh, Open3D, or ML models
  throw new Error('3D model hashing not yet implemented - requires server-side processing');
}

/**
 * Detect media type from MIME type and compute appropriate perceptual hash
 * @param file File to process
 * @param mimeType MIME type of file
 * @returns Promise with hash and type
 */
export async function computePerceptualHash(
  file: File,
  mimeType: string
): Promise<{ hash: string; type: string }> {
  // Image files: use dHash (faster and good enough)
  if (mimeType.startsWith('image/')) {
    const hash = await computeImageDHash(file);
    return { hash, type: 'dhash' };
  }

  // Audio files: would use Chromaprint (not yet implemented)
  if (mimeType.startsWith('audio/')) {
    throw new Error('Audio perceptual hashing not yet implemented');
  }

  // 3D models: would use geometric hashing (not yet implemented)
  if (
    mimeType.startsWith('model/') ||
    mimeType === 'application/octet-stream' // glb files
  ) {
    throw new Error('3D model perceptual hashing not yet implemented');
  }

  // Video (future): would use video fingerprinting
  if (mimeType.startsWith('video/')) {
    throw new Error('Video perceptual hashing not yet implemented');
  }

  throw new Error(`Unsupported media type for perceptual hashing: ${mimeType}`);
}

/**
 * Similarity thresholds for different hash types
 * These are starting points and should be tuned based on your dataset
 */
export const SIMILARITY_THRESHOLDS = {
  dhash: 10, // Hamming distance <= 10 (out of 64 bits)
  ahash: 10,
  phash: 10, // When pHash is implemented
  chromaprint: 0.85, // Similarity score >= 0.85 (0-1 range)
  geometric: 0.90, // Cosine similarity >= 0.90 for 3D embeddings
};
