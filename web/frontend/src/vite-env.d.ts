/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_SOURCE_UPLOAD?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_TRIAL_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
