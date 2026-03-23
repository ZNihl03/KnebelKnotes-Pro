import type { ReactNode } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Categories from "@/pages/Categories";
import Settings from "@/pages/Settings";
import { useAuth } from "@/contexts/AuthContext";
import { UiPreferencesProvider, UI_PREFERENCES_STORAGE_KEY } from "@/contexts/UiPreferencesContext";
import { supabase } from "@/lib/supabaseClient";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      updateUser: vi.fn(),
    },
  },
}));

vi.mock("@/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mockAuthValue = {
  user: {
    id: "user-1",
    email: "user@example.com",
    user_metadata: {},
  },
  profile: {
    id: "user-1",
    role: null,
    full_name: "User Example",
    username: "user.example",
    email: "user@example.com",
    profile_image_path: null,
    created_at: null,
  },
  loading: false,
  session: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
};

const categoryRows = [
  {
    id: "category-1",
    short_code: "MDD",
    name: "Depression",
    description: "Mood disorder category",
  },
];

const mockCategoriesQuery = () => {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table !== "categories") {
      throw new Error(`Unexpected table queried in test: ${table}`);
    }

    return {
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({
          data: categoryRows,
          error: null,
        }),
      })),
    } as never;
  });
};

describe("category ID visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(useAuth).mockReturnValue(mockAuthValue as never);
    mockCategoriesQuery();
  });

  it("hides category IDs by default on the categories page", async () => {
    render(
      <MemoryRouter>
        <UiPreferencesProvider>
          <Categories />
        </UiPreferencesProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Depression")).toBeInTheDocument();
    });

    expect(screen.queryByText("MDD")).not.toBeInTheDocument();
  });

  it("shows category IDs after enabling the setting", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <UiPreferencesProvider>
          <Settings />
        </UiPreferencesProvider>
      </MemoryRouter>,
    );

    const toggle = screen.getByRole("switch", { name: "Show category IDs" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });

    expect(JSON.parse(window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY) ?? "{}")).toEqual({
      showCategoryIds: true,
    });

    unmount();

    render(
      <MemoryRouter>
        <UiPreferencesProvider>
          <Categories />
        </UiPreferencesProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Depression")).toBeInTheDocument();
    });

    expect(screen.getByText("MDD")).toBeInTheDocument();
  });
});
