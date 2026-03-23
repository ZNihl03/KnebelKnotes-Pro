import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type UiPreferencesContextValue = {
  showCategoryIds: boolean;
  setShowCategoryIds: (value: boolean) => void;
};

type StoredUiPreferences = {
  showCategoryIds?: boolean;
};

export const UI_PREFERENCES_STORAGE_KEY = "ui-preferences";

const UiPreferencesContext = createContext<UiPreferencesContextValue | undefined>(undefined);

const loadStoredPreferences = (): StoredUiPreferences => {
  if (typeof window === "undefined") {
    return {};
  }

  const storedValue = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);

  if (!storedValue) {
    return {};
  }

  try {
    return (JSON.parse(storedValue) as StoredUiPreferences) ?? {};
  } catch {
    return {};
  }
};

export const UiPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [showCategoryIds, setShowCategoryIds] = useState<boolean>(() => {
    const storedPreferences = loadStoredPreferences();
    return storedPreferences.showCategoryIds ?? false;
  });

  useEffect(() => {
    window.localStorage.setItem(
      UI_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        showCategoryIds,
      }),
    );
  }, [showCategoryIds]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== UI_PREFERENCES_STORAGE_KEY) {
        return;
      }

      const storedPreferences = loadStoredPreferences();
      setShowCategoryIds(storedPreferences.showCategoryIds ?? false);
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const value = useMemo(
    () => ({
      showCategoryIds,
      setShowCategoryIds,
    }),
    [showCategoryIds],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
};

export const useUiPreferences = () => {
  const context = useContext(UiPreferencesContext);

  if (!context) {
    throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  }

  return context;
};
