import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.js";
import { ToastProvider } from "./components/toast.js";
import { applyBrandColor, getStoredBrandColor } from "./lib/brand.js";
import "./styles.css";

// Apply persisted brand color before first paint so themed pages don't
// flash with the default palette. Server-loaded settings refresh this
// value once /api/settings resolves (see BrandSync).
applyBrandColor(getStoredBrandColor());

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
