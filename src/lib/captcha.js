// Captcha configuration (Cloudflare Turnstile — supported by Supabase Auth).
//
// The SITE key is public and safe in the browser. The matching SECRET goes in
// the Supabase dashboard: Authentication → Settings → Bot and Abuse Protection
// → enable Captcha, provider "Turnstile", paste the secret.
//
// SAFETY: if VITE_TURNSTILE_SITE_KEY is unset, CAPTCHA_ENABLED is false — the
// widget doesn't render and no captchaToken is sent, so auth behaves exactly as
// it does today. Enable the site key here AND the captcha in the Supabase
// dashboard together (server-side enforcement and client tokens must match).

export const CAPTCHA_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
export const CAPTCHA_ENABLED = Boolean(CAPTCHA_SITE_KEY)
export const CAPTCHA_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
