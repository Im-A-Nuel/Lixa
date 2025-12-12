# Multi-Layer Duplicate Detection System

## Ringkasan

Sistem deteksi duplikasi multi-layer untuk mencegah upload file duplikat di marketplace. Implementasi ini menggunakan kombinasi **exact duplicate detection** (CID/SHA-256) dan **near-duplicate detection** (perceptual hashing) sesuai best practices.

## Arsitektur Deteksi

### Layer 1: IPFS CID (Exact Duplicate)
- **Metode**: Content Identifier (CID) dari IPFS
- **Kegunaan**: Deteksi file yang identik persis di byte-level
- **Kelebihan**: Deterministik - file sama = CID sama
- **Database**: Field `ipfsCid` dengan UNIQUE constraint

### Layer 2: SHA-256 Hash (Exact Duplicate)
- **Metode**: SHA-256 hash dari file content
- **Kegunaan**: Secondary verification untuk exact duplicates
- **Kelebihan**: Verifikasi tanpa dependency ke IPFS
- **Database**: Field `fileHash` dengan index

### Layer 3: Perceptual Hash (Near-Duplicate)
- **Metode**: dHash/pHash untuk gambar, Chromaprint untuk audio
- **Kegunaan**: Deteksi file similar meski ada perubahan (resize, re-encode, crop)
- **Kelebihan**: Robust terhadap minor modifications
- **Database**: Field `perceptualHash` + `perceptualType` dengan index
- **Algoritma**: Hamming distance untuk similarity scoring

## Implementasi

### 1. Database Schema (Prisma)

```prisma
model Asset {
  // Exact duplicate detection
  ipfsCid   String   @unique // IPFS CID
  fileHash  String   // SHA-256 hash

  // Near-duplicate detection
  perceptualHash String? // Perceptual hash
  perceptualType String? // "dhash", "phash", "chromaprint"

  // Canonicalization metadata
  canonicalWidth  Int?
  canonicalHeight Int?
  canonicalFormat String?

  @@index([perceptualHash])
  @@index([ipfsCid])
  @@index([fileHash])
}
```

### 2. Perceptual Hashing Library

File: `/src/lib/perceptualHash.ts`

**Fungsi Utama:**
- `computeImageDHash(file)` - Difference hash untuk gambar
- `computeImageAHash(file)` - Average hash untuk gambar
- `hammingDistance(hash1, hash2)` - Hitung similarity
- `areSimilarHashes(hash1, hash2, threshold)` - Cek similarity

**Algoritma dHash:**
1. Resize gambar ke 9x8 grayscale
2. Compare adjacent pixels horizontally
3. Generate 64-bit hash (1 jika left < right, else 0)
4. Convert binary ke hex string

**Threshold Recommendation:**
- Gambar (dHash): Hamming distance ≤ 10 (dari 64 bits)
- Semakin kecil distance = semakin mirip

### 3. API Check Duplicate

Endpoint: `POST /api/asset/check-duplicate`

**Request Body:**
```json
{
  "ipfsCid": "Qm...",
  "fileHash": "sha256hex",
  "perceptualHash": "hexstring",
  "mimeType": "image/png",
  "creator": "0x..."
}
```

**Response - Exact Duplicate:**
```json
{
  "isDuplicate": true,
  "duplicateType": "exact",
  "matchLayer": "cid",
  "confidence": 1.0,
  "asset": {...},
  "isSameCreator": true,
  "message": "You have already uploaded this exact file (CID match)"
}
```

**Response - Near Duplicate:**
```json
{
  "isDuplicate": true,
  "duplicateType": "near",
  "matchLayer": "perceptual",
  "confidence": 0.92,
  "hammingDistance": 5,
  "asset": {...},
  "similarAssets": [...],
  "message": "A similar file has been uploaded (92% similar)"
}
```

**Response - No Duplicate:**
```json
{
  "isDuplicate": false,
  "message": "File is unique and can be uploaded"
}
```

### 4. API Register Asset

Endpoint: `POST /api/asset/register`

**Request Body (Extended):**
```json
{
  "ipfsCid": "Qm...",
  "fileHash": "sha256hex",
  "creator": "0x...",
  "fileName": "asset.png",
  "fileSize": 123456,
  "mimeType": "image/png",

  // NEW: Perceptual hashing data
  "perceptualHash": "hexstring",
  "perceptualType": "dhash",
  "canonicalWidth": 2048,
  "canonicalHeight": 1536,
  "canonicalFormat": "PNG"
}
```

## Workflow Upload dengan Duplicate Detection

### Client-Side Flow:

```typescript
// 1. User selects file
const file = event.target.files[0];

// 2. Compute SHA-256 hash
const fileHash = await computeFileHash(file);

// 3. Compute perceptual hash (untuk gambar)
let perceptualHash = null;
if (file.type.startsWith('image/')) {
  perceptualHash = await computeImageDHash(file);
}

// 4. Check duplicate BEFORE uploading to IPFS
const checkResult = await fetch('/api/asset/check-duplicate', {
  method: 'POST',
  body: JSON.stringify({
    fileHash,
    perceptualHash,
    mimeType: file.type,
    creator: address
  })
});

const { isDuplicate, duplicateType, confidence, asset } = await checkResult.json();

// 5. Handle duplicate
if (isDuplicate) {
  if (duplicateType === 'exact') {
    alert('This exact file has already been uploaded!');
    // Show existing asset
    return;
  } else {
    // Near-duplicate
    const proceed = confirm(
      `A similar file (${Math.round(confidence * 100)}% match) ` +
      `already exists. Do you want to proceed?`
    );
    if (!proceed) return;
  }
}

// 6. Upload to IPFS (only if no duplicate or user confirmed)
const ipfsResult = await uploadToIPFS(file);
const { cid } = ipfsResult;

// 7. Register asset with all detection metadata
await registerAsset({
  ipfsCid: cid,
  fileHash,
  perceptualHash,
  perceptualType: 'dhash',
  // ... other fields
});
```

## Media Type Support

### ✅ Implemented: Images
- **Metode**: dHash (difference hash)
- **Library**: Canvas API (client-side)
- **Support**: PNG, JPEG, WebP, GIF

### 🔄 Planned: Audio
- **Metode**: Chromaprint (acoustic fingerprinting)
- **Tools**: ffmpeg + fpcalc (server-side)
- **Workflow**:
  1. Decode ke PCM WAV (44.1kHz mono)
  2. Run fpcalc untuk generate fingerprint
  3. Compare dengan AcoustID database atau Hamming distance

### 🔄 Planned: 3D Models
- **Metode**: Geometric signatures + ML embeddings
- **Tools**: Blender (canonicalization) + trimesh/Open3D
- **Workflow**:
  1. Convert ke glTF
  2. Normalize (scale, orientation, vertex order)
  3. Compute ShapeDNA atau spherical harmonic descriptors
  4. Store embeddings untuk vector similarity search (FAISS)

## Tuning & Optimization

### Similarity Thresholds

Current values (tunable):
```typescript
const SIMILARITY_THRESHOLDS = {
  dhash: 10,        // Hamming distance ≤ 10 (images)
  ahash: 10,
  phash: 10,
  chromaprint: 0.85, // Similarity score ≥ 0.85 (audio)
  geometric: 0.90    // Cosine similarity ≥ 0.90 (3D)
};
```

**Tuning Guidelines:**
- Lower threshold = stricter (more false positives)
- Higher threshold = looser (more false negatives)
- Test dengan dataset representatif
- Monitor false positive/negative rates

### Database Indexes

Optimized for query performance:
```sql
CREATE INDEX "Asset_ipfsCid_idx" ON "Asset"("ipfsCid");
CREATE INDEX "Asset_fileHash_idx" ON "Asset"("fileHash");
CREATE INDEX "Asset_perceptualHash_idx" ON "Asset"("perceptualHash");
CREATE INDEX "Asset_mimeType_idx" ON "Asset"("mimeType");
```

### Performance Considerations

1. **Perceptual Hash Computation**:
   - Client-side (Canvas API) untuk gambar: ~50-100ms
   - Server-side untuk audio/3D: ~500-2000ms

2. **Database Query**:
   - Exact match (CID/hash): O(1) dengan index
   - Near-duplicate (perceptual): O(n) - scan all candidates
   - Optimization: Filter by mimeType first

3. **Scaling Strategy**:
   - For large datasets (>10k assets): Use vector database (FAISS, Milvus)
   - Embeddings untuk semantic similarity search
   - Approximate Nearest Neighbor (ANN) search

## Testing

### Test Cases

1. **Exact Duplicate**:
   - Upload file yang sama 2x → Should reject
   - CID dan SHA-256 harus match

2. **Near-Duplicate**:
   - Upload gambar yang di-resize → Should detect (if similarity > threshold)
   - Upload gambar yang di-re-encode (JPEG quality change) → Should detect
   - Upload gambar dengan minor crop → Should detect

3. **Different Files**:
   - Upload 2 gambar berbeda → Should allow both
   - Hamming distance should be > threshold

### Manual Testing Script

```bash
# Test 1: Upload file
curl -X POST /api/asset/check-duplicate \
  -H "Content-Type: application/json" \
  -d '{
    "fileHash": "abc123...",
    "perceptualHash": "def456...",
    "mimeType": "image/png",
    "creator": "0x..."
  }'

# Test 2: Upload same file again
# Should return isDuplicate: true, duplicateType: "exact"

# Test 3: Upload similar file (resized version)
# Should return isDuplicate: true, duplicateType: "near", confidence: 0.9+
```

## Roadmap

### Phase 1: ✅ Completed
- [x] CID-based exact duplicate detection
- [x] SHA-256 hash verification
- [x] Image perceptual hashing (dHash)
- [x] Multi-layer API implementation
- [x] Database schema with indexes

### Phase 2: 🔄 In Progress
- [ ] Frontend integration dengan upload workflow
- [ ] User interface untuk duplicate warnings
- [ ] Preview similar assets UI

### Phase 3: 📋 Planned
- [ ] Audio fingerprinting (Chromaprint)
- [ ] 3D model geometric hashing
- [ ] Vector database integration (FAISS/Milvus)
- [ ] Advanced ML embeddings (CLIP untuk images)
- [ ] Blockchain registration (fingerprint → owner mapping)

## Troubleshooting

### Issue: False Positives
**Symptom**: File berbeda terdeteksi sebagai duplicate
**Solution**: Increase Hamming distance threshold (e.g., 10 → 15)

### Issue: False Negatives
**Symptom**: File similar tidak terdeteksi
**Solution**: Decrease threshold atau gunakan pHash instead of dHash

### Issue: Slow Queries
**Symptom**: Check duplicate API timeout
**Solution**:
1. Ensure indexes exist: `CREATE INDEX "Asset_perceptualHash_idx"`
2. Filter by mimeType before scanning
3. Consider vector database for large datasets

## References

- IPFS Content Addressing: https://docs.ipfs.tech/concepts/content-addressing/
- ImageHash Library (Python): https://github.com/JohannesBuchner/imagehash
- Chromaprint (Audio): https://acoustid.org/chromaprint
- ShapeDNA (3D): https://people.csail.mit.edu/sumner/research/deftrans/Reuter-ShapeDNA.pdf

## Support & Contact

For questions or issues, please refer to the main project documentation or create an issue in the repository.
