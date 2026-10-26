// Public contact address shown on the site, legal pages, status page and the in-app Help link.
// Set VITE_CONTACT_EMAIL for your deployment (.env.example); the placeholder below is never a real inbox.
import { env } from './env.js';
export const CONTACT_EMAIL = env('VITE_CONTACT_EMAIL') || 'hello@example.com';
