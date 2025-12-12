/**
 * File hashing utility for deduplication
 * Uses SHA-256 to create unique fingerprints of uploaded files
 */

/**
 * Calculate SHA-256 hash of a file
 * @param file - File object to hash
 * @returns Promise with hex string of hash
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Calculate combined hash of file content + metadata
 * This creates a more unique fingerprint including file metadata
 * @param file - File object
 * @returns Promise with hex string of combined hash
 */
export async function calculateAssetFingerprint(file: File): Promise<string> {
  // Get content hash
  const contentHash = await calculateFileHash(file);

  // Create metadata string (filename + size + type)
  const metadata = `${file.name}|${file.size}|${file.type}`;

  // Hash the metadata
  const encoder = new TextEncoder();
  const metadataBuffer = encoder.encode(metadata);
  const metadataHashBuffer = await crypto.subtle.digest('SHA-256', metadataBuffer);
  const metadataHashArray = Array.from(new Uint8Array(metadataHashBuffer));
  const metadataHashHex = metadataHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Combine both hashes
  const combined = `${contentHash}:${metadataHashHex}`;

  // Hash the combined string for final fingerprint
  const combinedBuffer = encoder.encode(combined);
  const finalHashBuffer = await crypto.subtle.digest('SHA-256', combinedBuffer);
  const finalHashArray = Array.from(new Uint8Array(finalHashBuffer));
  const finalHashHex = finalHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return finalHashHex;
}
