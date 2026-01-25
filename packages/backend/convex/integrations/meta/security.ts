/**
 * Meta Platform Webhook Security
 * Implements HMAC-SHA256 signature verification for webhook requests
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 * @see https://developers.facebook.com/docs/messenger-platform/webhooks#security
 */

/**
 * Verify Meta webhook signature using HMAC-SHA256
 *
 * Meta sends a signature in the X-Hub-Signature-256 header in the format:
 * "sha256=<hex digest>"
 *
 * @param payload - The raw request body as a string
 * @param signature - The X-Hub-Signature-256 header value (includes "sha256=" prefix)
 * @param appSecret - The Meta App Secret from App Dashboard
 * @returns boolean indicating if the signature is valid
 *
 * @example
 * ```ts
 * const signature = request.headers.get("X-Hub-Signature-256");
 * const body = await request.text();
 * const appSecret = process.env.META_APP_SECRET;
 *
 * if (verifyMetaSignature(body, signature, appSecret)) {
 *   // Signature is valid, process the webhook
 * }
 * ```
 */
export function verifyMetaSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  // Validate inputs
  if (!payload || !signature || !appSecret) {
    return false;
  }

  // Meta signatures are prefixed with "sha256="
  const prefix = "sha256=";
  if (!signature.startsWith(prefix)) {
    return false;
  }

  // Extract the hex digest (everything after "sha256=")
  const expectedHex = signature.slice(prefix.length);

  // Validate the hex format (should be 64 hex characters for SHA256)
  if (!/^[a-f0-9]{64}$/i.test(expectedHex)) {
    return false;
  }

  // Compute HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const messageData = encoder.encode(payload);

  const computedHmac = computeHmacSha256(keyData, messageData);
  const computedHex = uint8ArrayToHex(computedHmac);

  // Use constant-time comparison to prevent timing attacks
  return timingSafeEqual(computedHex.toLowerCase(), expectedHex.toLowerCase());
}

/**
 * Convert Uint8Array to hexadecimal string
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison to prevent timing attacks
 * Returns true if both strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Compute HMAC-SHA256 using a pure JavaScript implementation
 * This is necessary because Convex doesn't provide access to Node.js crypto module
 */
function computeHmacSha256(
  keyData: Uint8Array,
  messageData: Uint8Array
): Uint8Array {
  const blockSize = 64;

  // If key is longer than block size, hash it
  let key = keyData;
  if (keyData.length > blockSize) {
    key = sha256(keyData);
  }

  // Pad key to block size
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(key);

  // Create inner and outer padding
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  // Inner hash: SHA256(ipad || message)
  const innerData = new Uint8Array(blockSize + messageData.length);
  innerData.set(ipad);
  innerData.set(messageData, blockSize);
  const innerHash = sha256(innerData);

  // Outer hash: SHA256(opad || innerHash)
  const outerData = new Uint8Array(blockSize + 32);
  outerData.set(opad);
  outerData.set(innerHash, blockSize);

  return sha256(outerData);
}

/**
 * SHA-256 implementation
 * Pure JavaScript implementation for use in Convex environment
 */
function sha256(data: Uint8Array): Uint8Array {
  // SHA-256 constants
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  // Initial hash values
  let H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);

  // Pre-processing: adding padding bits
  const msgLen = data.length;
  const bitLen = msgLen * 8;
  const padLen = (msgLen + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[msgLen] = 0x80;

  // Append original length in bits as 64-bit big-endian
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen, false);

  // Message schedule array
  const W = new Uint32Array(64);

  // Process each 64-byte block
  for (let i = 0; i < padLen; i += 64) {
    // Prepare message schedule
    for (let j = 0; j < 16; j++) {
      W[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 =
        ((W[j - 15] >>> 7) | (W[j - 15] << 25)) ^
        ((W[j - 15] >>> 18) | (W[j - 15] << 14)) ^
        (W[j - 15] >>> 3);
      const s1 =
        ((W[j - 2] >>> 17) | (W[j - 2] << 15)) ^
        ((W[j - 2] >>> 19) | (W[j - 2] << 13)) ^
        (W[j - 2] >>> 10);
      W[j] = (W[j - 16] + s0 + W[j - 7] + s1) >>> 0;
    }

    // Working variables
    let [a, b, c, d, e, f, g, h] = H;

    // Compression function
    for (let j = 0; j < 64; j++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + W[j]) >>> 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    // Update hash values
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  // Produce final hash value (big-endian)
  const result = new Uint8Array(32);
  const resultView = new DataView(result.buffer);
  for (let i = 0; i < 8; i++) {
    resultView.setUint32(i * 4, H[i], false);
  }
  return result;
}
