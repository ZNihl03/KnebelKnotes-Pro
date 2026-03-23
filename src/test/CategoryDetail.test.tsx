import type { ReactNode } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CategoryDetail from "@/pages/CategoryDetail";
import { useAuth } from "@/contexts/AuthContext";
import { UiPreferencesProvider } from "@/contexts/UiPreferencesContext";
import { supabase } from "@/lib/supabaseClient";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mockCategory = {
  id: "category-1",
  short_code: "MDD",
  name: "Depression",
  description: "Mood disorder category",
  diagnosis: "<p>Diagnosis content</p>",
  treatment: "<p>Treatment content</p>",
  patient_education: "<p>Patient education</p>",
  improvement: null,
  reassessment: "<p>Assessment notes</p>",
  trial: null,
  assessment_initial_response: "<p>Initial response content</p>",
  assessment_change_treatment: "<p>Change treatment content</p>",
  assessment_dose_optimization: "<p>Dose optimization content</p>",
};

describe("CategoryDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table !== "categories") {
        throw new Error(`Unexpected table queried in test: ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockCategory,
              error: null,
            }),
          })),
        })),
      } as never;
    });

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [],
      error: null,
    } as never);
  });

  it("shows the Antidepressant Augment floating tab and reuses assessment content", async () => {
    render(
      <MemoryRouter initialEntries={["/category/category-1"]}>
        <UiPreferencesProvider>
          <Routes>
            <Route path="/category/:id" element={<CategoryDetail />} />
          </Routes>
        </UiPreferencesProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Depression" })).toBeInTheDocument();
    });

    const augmentTab = screen.getByRole("link", { name: "Antidepressant Augment" });
    expect(augmentTab).toBeInTheDocument();

    fireEvent.click(augmentTab);

    await waitFor(() => {
      expect(augmentTab).toHaveAttribute("aria-current", "page");
    });

    expect(screen.getByText("Additional assessment notes")).toBeInTheDocument();
    expect(screen.queryByText("Current response pattern")).not.toBeInTheDocument();
    expect(screen.queryByText("3.1.1")).not.toBeInTheDocument();
    expect(screen.queryByText("Assessment of initial response")).not.toBeInTheDocument();
    expect(screen.queryByText("Assess for change of treatment")).not.toBeInTheDocument();
  });

  it("supports next and back navigation across the floating tabs", async () => {
    render(
      <MemoryRouter initialEntries={["/category/category-1"]}>
        <UiPreferencesProvider>
          <Routes>
            <Route path="/category/:id" element={<CategoryDetail />} />
          </Routes>
        </UiPreferencesProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Depression" })).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", { name: "Back" });
    expect(backButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next: Initiation of Treatment" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Initiation of Treatment" })).toHaveAttribute("aria-current", "page");
    });

    expect(screen.getByText("No medications are configured for this category yet.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next: Assessment of Response" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Assessment of Response" })).toHaveAttribute("aria-current", "page");
    });

    expect(screen.getByText("Additional assessment notes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next: Antidepressant Augment" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Antidepressant Augment" })).toHaveAttribute("aria-current", "page");
    });

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Back: Assessment of Response" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Assessment of Response" })).toHaveAttribute("aria-current", "page");
    });
  });
});
