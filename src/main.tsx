import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { UiPreferencesProvider } from "@/contexts/UiPreferencesContext";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="data-theme" storageKey="theme" defaultTheme="system" enableSystem>
    <UiPreferencesProvider>
      <App />
    </UiPreferencesProvider>
  </ThemeProvider>,
);
