import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: '/contract-lifecycle-workspace/react/',
  plugins: [react()],
  // Syncfusion Document Editor / PDF Viewer service URL (stateless ASP.NET Core service)
  // Configurable via env; never hardcode in source logic.
  define: {
    __DOCUMENT_EDITOR_SERVICE_URL__: JSON.stringify(
      process.env.VITE_DOCUMENT_EDITOR_SERVICE_URL ?? "https://localhost:5001"
    ),
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    target: "es2022",
    sourcemap: false,
    // Route-level chunking: heavy Syncfusion features (Document Editor, PDF Viewer)
    // are lazy-loaded so they do not bloat the initial bundle.
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Heavy Syncfusion feature chunks (lazy route imports place these behind page splits)
          "sf-documenteditor": [
            "@syncfusion/ej2-react-documenteditor",
            "@syncfusion/ej2-documenteditor",
          ],
          "sf-pdfviewer": [
            "@syncfusion/ej2-react-pdfviewer",
            "@syncfusion/ej2-pdfviewer",
          ],
        },
      },
    },
  },
});
