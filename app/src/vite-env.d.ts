/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Base origin of the API. Empty in dev (Vite proxies /api → :9002); set to
   *  e.g. https://pickleballer-api.eunika.xyz in production. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
