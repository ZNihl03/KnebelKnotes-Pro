import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import InitiationOfTreatment from "@/pages/InitiationOfTreatment";
import { useAuth } from "@/contexts/AuthContext";
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

describe("InitiationOfTreatment", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  it("shows treatment rows to anonymous visitors without edit controls", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          id: "drug-1",
          category_id: "category-1",
          drug_name: "Sertraline",
          medication_type: "monotherapy",
          frequency: "daily",
          line_of_treatment: 1,
          initiation_dose_mg: 50,
          therapeutic_min_dose_mg: 50,
          therapeutic_max_dose_mg: 200,
          max_dose_mg: 200,
          updated_at: "2026-03-16T12:00:00.000Z",
          is_active: true,
        },
      ],
      error: null,
    } as never);

    render(
      <MemoryRouter>
        <InitiationOfTreatment categoryId="category-1" categoryName="Depression" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Initiation of Treatment")).toBeInTheDocument();
    });

    const factorsHeading = screen.getByRole("heading", { name: "Factors to consider" });
    const lineSelectionHeading = screen.getByRole("heading", { name: "Select line of treatment" });

    expect(
      factorsHeading.compareDocumentPosition(lineSelectionHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Line 1" }));

    await waitFor(() => {
      expect(screen.getByText("Sertraline")).toBeInTheDocument();
    });

    expect(screen.queryByText("Approve + direct edit access")).not.toBeInTheDocument();
    expect(screen.getByText("Select line of treatment")).toBeInTheDocument();
    expect(screen.getByText("Factors to consider")).toBeInTheDocument();
    expect(screen.getByText("Pick a starting dose and titration schedule")).toBeInTheDocument();
    expect(screen.getByText("Patient education")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse medication table" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in to make changes" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Updated" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Propose change" })).not.toBeInTheDocument();
  });

  it("selects a medication from the table and scrolls to the medication picker", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          id: "drug-1",
          category_id: "category-1",
          drug_name: "Sertraline",
          medication_type: "monotherapy",
          frequency: "daily",
          line_of_treatment: 1,
          initiation_dose_mg: 50,
          therapeutic_min_dose_mg: 50,
          therapeutic_max_dose_mg: 200,
          max_dose_mg: 200,
          updated_at: "2026-03-16T12:00:00.000Z",
          is_active: true,
        },
        {
          id: "drug-2",
          category_id: "category-1",
          drug_name: "Fluoxetine",
          medication_type: "monotherapy",
          frequency: "daily",
          line_of_treatment: 1,
          initiation_dose_mg: 20,
          therapeutic_min_dose_mg: 20,
          therapeutic_max_dose_mg: 60,
          max_dose_mg: 80,
          updated_at: "2026-03-16T12:00:00.000Z",
          is_active: true,
        },
      ],
      error: null,
    } as never);

    render(
      <MemoryRouter>
        <InitiationOfTreatment categoryId="category-1" categoryName="Depression" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Initiation of Treatment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Line 1" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select medication Fluoxetine" })).toBeInTheDocument();
    });

    scrollIntoViewMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Select medication Fluoxetine" }));

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Fluoxetine");
    });

    const drugNameCard = screen.getByText("Drug name").closest("div");
    expect(drugNameCard).not.toBeNull();
    expect(within(drugNameCard!).getByText("Fluoxetine")).toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("does not show the updated detail card below the medication selector", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "user-1",
      },
      profile: null,
      loading: false,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    } as never);

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          id: "drug-1",
          category_id: "category-1",
          drug_name: "Sertraline",
          medication_type: "monotherapy",
          frequency: "daily",
          line_of_treatment: 1,
          initiation_dose_mg: 50,
          therapeutic_min_dose_mg: 50,
          therapeutic_max_dose_mg: 200,
          max_dose_mg: 200,
          updated_at: "2026-03-16T12:00:00.000Z",
          is_active: true,
        },
      ],
      error: null,
    } as never);

    render(
      <MemoryRouter>
        <InitiationOfTreatment categoryId="category-1" categoryName="Depression" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Initiation of Treatment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Line 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Select medication Sertraline" }));

    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "Updated" })).toBeInTheDocument();
    });

    expect(
      screen.queryByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Updated"),
    ).not.toBeInTheDocument();
  });
});
