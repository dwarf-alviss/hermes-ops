// Расшифровка полезной нагрузки, зашифрованной так:
//   openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in plain.json -out out.bin -pass file:pass
// Формат: "Salted__" (8 байт) + salt (8) + ciphertext(PKCS#7).

// Ключ и IV: PBKDF2-HMAC-SHA256(password, salt, 200000) → 48 байт (первые 32 — ключ,
// последние 16 — IV). Это поведение `openssl enc -pbkdf2` в OpenSSL 3.x.

const MAGIC = 'Salted__'

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '')
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function decryptOpenSSL(b64: string, password: string): Promise<string> {
  const raw = b64ToBytes(b64)
  if (raw.length < 32) throw new Error('Короткий шифртекст')
  const magic = new TextDecoder().decode(raw.slice(0, 8))
  if (magic !== MAGIC) throw new Error('Неверный формат шифртекста')
  const salt = raw.slice(8, 16)
  const ct = raw.slice(16)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
    baseKey,
    384,
  )
  const derived = new Uint8Array(bits)
  const key = await crypto.subtle.importKey('raw', derived.slice(0, 32), { name: 'AES-CBC' }, false, [
    'decrypt',
  ])
  const iv = derived.slice(32, 48)
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ct)
    return new TextDecoder().decode(plain)
  } catch {
    throw new Error('Не удалось расшифровать: неверный логин или пароль')
  }
}
