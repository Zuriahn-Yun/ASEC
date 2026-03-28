import { createClient } from '@insforge/sdk';

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

export const insforge = createClient({
  baseUrl,
  anonKey,
});

// Token helpers — InsForge SDK stores tokens internally but doesn't expose
// them for forwarding to our own API routes. We store the access token in
// localStorage so client-side code can attach it as an Authorization header.

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('insforge_access_token');
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('insforge_access_token', token);
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('insforge_access_token');
}

export function hasStoredAccessToken(): boolean {
  return Boolean(getAccessToken());
}

export function getScanOwnerId(userId?: string | null): string {
  return userId || DEMO_USER_ID;
}

export function getScannerUrl(): string {
  return process.env.SCANNER_URL || process.env.NEXT_PUBLIC_SCANNER_URL || 'http://localhost:4000';
}
