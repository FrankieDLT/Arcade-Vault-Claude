// Sub-path the site is served from (GitHub Pages: "/Arcade-Vault-Claude"), empty locally.
// next/link and next/navigation add it on their own; raw URL strings (audio, images) need this.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const withBasePath = (path: string): string => BASE_PATH + path;
