/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOCUMENT_EDITOR_SERVICE_URL: string;
  readonly VITE_SYNCFUSION_LICENSE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __DOCUMENT_EDITOR_SERVICE_URL__: string;
