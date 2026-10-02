import { decryptOpenSSL } from './crypto'
import type { StatusPayload } from './types'

// Публичная репа с данными. Внутри — только шифртекст: без пароля не читается.
export const DATA_URL =
  'https://raw.githubusercontent.com/dwarf-alviss/hermes-ops-data/main/status.v1.json'

export const LOGIN = 'kolya'

export type RawEnvelope = { v: number; alg: string; generated_at: string; data: string }

export async function fetchAndDecrypt(password: string): Promise<{ payload: StatusPayload; generated_at: string }> {
  const res = await fetch(`${DATA_URL}?cb=${Math.floor(Date.now() / 60000)}`)
  if (!res.ok) throw new Error(`Данные недоступны (HTTP ${res.status})`)
  const env = (await res.json()) as RawEnvelope
  if (!env?.data) throw new Error('Пустой конверт с данными')
  const plain = await decryptOpenSSL(env.data, password)
  const payload = JSON.parse(plain) as StatusPayload
  return { payload, generated_at: payload.generated_at || env.generated_at }
}

export async function checkCredentials(login: string, password: string): Promise<StatusPayload> {
  if (login.trim().toLowerCase() !== LOGIN) {
    throw new Error('Неизвестный логин')
  }
  const { payload } = await fetchAndDecrypt(password)
  return payload
}

export { fetchAndDecrypt as refresh }
