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
  const mockPendingQueueQuery = (
    pendingRows: Array<Record<string, unknown>> = [],
    profileRows: Array<Record<string, unknown>> = [],
  ) => {
    const pendingResult = { data: pendingRows, error: null };
    const pendingQuery = {
      eq: vi.fn(),
      order: vi.fn(),
      then: vi.fn(),
    };
    pendingQuery.eq.mockImplementation(() => pendingQuery);
    pendingQuery.order.mockImplementation(() => pendingQuery);
    pendingQuery.then.mockImplementation((resolve: (value: typeof pendingResult) => unknown) =>
      Promise.resolve(resolve(pendingResult)),
    );

    const pendingSelect = vi.fn(() => pendingQuery);
    const profileIn = vi.fn().mockResolvedValue({ data: profileRows, error: null });
    const profileSelect = vi.fn(() => ({ in: profileIn }));

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "pending_antidepressant_edits") {
        return { select: pendingSelect } as never;
      }

      if (table === "profiles") {
        return { select: profileSelect } as never;
      }

      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      } as never;
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
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
          tolerability_less: null,
          tolerability_more: null,
          safety: null,
          cost: null,
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

    expect(screen.getByText("2.0")).toBeInTheDocument();
    expect(screen.getByText("2.1")).toBeInTheDocument();

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
    expect(screen.getByText("2.2")).toBeInTheDocument();
    expect(screen.getByText("2.3")).toBeInTheDocument();
    expect(screen.getByText("2.4")).toBeInTheDocument();
    expect(screen.getByText("Factors to consider")).toBeInTheDocument();
    expect(screen.getByText("Pick a starting dose and titration schedule")).toBeInTheDocument();
    expect(screen.getByText("Patient education")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse medication table" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in to make changes" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Updated" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Therapeutic Range" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Frequency" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Initiation Dose" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Max Dose" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Tolerability: Less/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Tolerability: More/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Safety" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Cost" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Propose change for / })).not.toBeInTheDocument();
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
          tolerability_less: null,
          tolerability_more: null,
          safety: null,
          cost: null,
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
          tolerability_less: null,
          tolerability_more: null,
          safety: null,
          cost: null,
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

    expect(
      screen.getByText("Use the information below to choose the starting dose and titration schedule for this medication."),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Starting dose"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Therapeutic range"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Max dose / 24hrs"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Tolerability: Less / Least"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Tolerability: More / Most"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Safety & Cost"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Drug name"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Medication type"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Frequency"),
    ).not.toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("shows one shared titration schedule editor for the category after a medication is selected", async () => {
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
          tolerability_less: null,
          tolerability_more: null,
          safety: null,
          cost: null,
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
          drug_name: "Escitalopram",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: null,
          tolerability_more: null,
          safety: null,
          cost: null,
          line_of_treatment: 1,
          initiation_dose_mg: 10,
          therapeutic_min_dose_mg: 10,
          therapeutic_max_dose_mg: 20,
          max_dose_mg: 20,
          updated_at: "2026-03-16T12:00:00.000Z",
          is_active: true,
        },
      ],
      error: null,
    } as never);

    const { container } = render(
      <MemoryRouter>
        <InitiationOfTreatment categoryId="category-1" categoryName="Depression" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Initiation of Treatment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Line 1" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select medication Sertraline" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select medication Escitalopram" })).toBeInTheDocument();
    });

    expect(screen.queryByText("Titration Schedule")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select medication Sertraline" }));

    await waitFor(() => {
      expect(screen.getByText("Titration Schedule")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit titration schedule" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit titration schedule" }));

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    editor.innerHTML = "<p>Shared titration note.</p>";
    fireEvent.input(editor);
    fireEvent.blur(editor);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Shared titration note.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Select medication Escitalopram" }));

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Escitalopram");
      expect(screen.getByText("Shared titration note.")).toBeInTheDocument();
    });
  });

  it("keeps signed-in workflow actions while omitting the updated and therapeutic range table columns", async () => {
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
          tolerability_less: null,
          tolerability_more: null,
          safety: null,
          cost: null,
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
      expect(screen.getAllByRole("button", { name: "View history for Sertraline" }).length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole("columnheader", { name: "Updated" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Therapeutic Range" })).not.toBeInTheDocument();
    expect(
      screen.getByText((content, element) => element?.tagName.toLowerCase() === "p" && content === "Therapeutic range"),
    ).toBeInTheDocument();
  });

  it("lets super admins delete a medication with audit trail", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "user-1",
      },
      profile: {
        role: "super_admin",
      },
      loading: false,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    } as never);

    mockPendingQueueQuery();
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: [
          {
            id: "drug-1",
            category_id: "category-1",
            drug_name: "Sertraline",
            medication_type: "monotherapy",
            frequency: "daily",
            tolerability_less: "↓ Sedation",
            tolerability_more: "↑ GI distress",
            safety: null,
            cost: "Low",
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
      } as never)
      .mockResolvedValueOnce({
        data: null,
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: [],
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
      expect(screen.getByRole("button", { name: "Add medication to Line 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete Sertraline" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Sertraline" }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Removing duplicate medication row." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete medication" }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("delete_antidepressant_with_audit", {
        p_drug_id: "drug-1",
        p_change_reason: "Removing duplicate medication row.",
      });
    });
  });

  it("lets reviewed proposals be removed from the workflow queue while keeping pending ones locked", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "user-1",
      },
      profile: {
        role: "super_admin",
      },
      loading: false,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    } as never);

    mockPendingQueueQuery([
      {
        id: "pending-approved",
        drug_id: "drug-1",
        category_id: "category-1",
        proposed_by_user_id: "user-2",
        previous_data: {
          drug_name: "Sertraline",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: "↓ Sedation",
          tolerability_more: null,
          safety: null,
          cost: "Low",
          line_of_treatment: 1,
          initiation_dose_mg: 50,
          therapeutic_min_dose_mg: 50,
          therapeutic_max_dose_mg: 200,
          max_dose_mg: 200,
          is_active: true,
        },
        proposed_data: {
          drug_name: "Sertraline",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: "↓ Sedation; ↓ Weight gain",
          tolerability_more: null,
          safety: null,
          cost: "Low",
          line_of_treatment: 1,
          initiation_dose_mg: 50,
          therapeutic_min_dose_mg: 50,
          therapeutic_max_dose_mg: 200,
          max_dose_mg: 200,
          is_active: true,
        },
        change_reason: "Add the reviewed tolerability note.",
        status: "approved",
        review_note: "Applied.",
        reviewed_by_user_id: "user-1",
        reviewed_at: "2026-03-30T16:00:00.000Z",
        created_at: "2026-03-30T15:00:00.000Z",
      },
      {
        id: "pending-open",
        drug_id: "drug-2",
        category_id: "category-1",
        proposed_by_user_id: "user-3",
        previous_data: {
          drug_name: "Fluoxetine",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: null,
          tolerability_more: null,
          safety: null,
          cost: "Low",
          line_of_treatment: 1,
          initiation_dose_mg: 20,
          therapeutic_min_dose_mg: 20,
          therapeutic_max_dose_mg: 60,
          max_dose_mg: 80,
          is_active: true,
        },
        proposed_data: {
          drug_name: "Fluoxetine",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: "↓ Sedation",
          tolerability_more: null,
          safety: null,
          cost: "Low",
          line_of_treatment: 1,
          initiation_dose_mg: 20,
          therapeutic_min_dose_mg: 20,
          therapeutic_max_dose_mg: 60,
          max_dose_mg: 80,
          is_active: true,
        },
        change_reason: "Add pending note.",
        status: "pending",
        review_note: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: "2026-03-30T17:00:00.000Z",
      },
    ]);

    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: [
          {
            id: "drug-1",
            category_id: "category-1",
            drug_name: "Sertraline",
            medication_type: "monotherapy",
            frequency: "daily",
            tolerability_less: "↓ Sedation",
            tolerability_more: null,
            safety: null,
            cost: "Low",
            line_of_treatment: 1,
            initiation_dose_mg: 50,
            therapeutic_min_dose_mg: 50,
            therapeutic_max_dose_mg: 200,
            max_dose_mg: 200,
            updated_at: "2026-03-30T16:30:00.000Z",
            is_active: true,
          },
          {
            id: "drug-2",
            category_id: "category-1",
            drug_name: "Fluoxetine",
            medication_type: "monotherapy",
            frequency: "daily",
            tolerability_less: null,
            tolerability_more: null,
            safety: null,
            cost: "Low",
            line_of_treatment: 1,
            initiation_dose_mg: 20,
            therapeutic_min_dose_mg: 20,
            therapeutic_max_dose_mg: 60,
            max_dose_mg: 80,
            updated_at: "2026-03-30T16:30:00.000Z",
            is_active: true,
          },
        ],
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: null,
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

    const workflowTab = screen.getByRole("tab", { name: "Pending Approvals" });
    fireEvent.mouseDown(workflowTab);
    fireEvent.click(workflowTab);

    await waitFor(() => {
      expect(workflowTab.getAttribute("aria-selected")).toBe("true");
      expect(screen.getByText("Sertraline")).toBeInTheDocument();
      expect(screen.getByText("Fluoxetine")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Remove Sertraline from workflow queue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Fluoxetine from workflow queue" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Sertraline from workflow queue" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from queue" }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("delete_reviewed_antidepressant_pending_edit", {
        p_pending_edit_id: "pending-approved",
      });
    });
  });

  it("lets super admins approve proposals even if the master row changed after submission", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "user-1",
      },
      profile: {
        role: "super_admin",
      },
      loading: false,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    } as never);

    mockPendingQueueQuery([
      {
        id: "pending-stale",
        drug_id: "drug-1",
        category_id: "category-1",
        proposed_by_user_id: "user-2",
        previous_data: {
          drug_name: "Sertraline",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: "↓ Sedation",
          tolerability_more: null,
          safety: null,
          cost: "Low",
          line_of_treatment: 1,
          initiation_dose_mg: 50,
          therapeutic_min_dose_mg: 50,
          therapeutic_max_dose_mg: 200,
          max_dose_mg: 200,
          is_active: true,
        },
        proposed_data: {
          drug_name: "Sertraline",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: "↓ Sedation; ↓ Weight gain",
          tolerability_more: null,
          safety: null,
          cost: "Low",
          line_of_treatment: 1,
          initiation_dose_mg: 50,
          therapeutic_min_dose_mg: 50,
          therapeutic_max_dose_mg: 200,
          max_dose_mg: 200,
          is_active: true,
        },
        change_reason: "Carry forward the reviewed tolerability update.",
        status: "pending",
        review_note: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: "2026-03-30T15:00:00.000Z",
      },
    ]);

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [
        {
          id: "drug-1",
          category_id: "category-1",
          drug_name: "Sertraline",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: "↓ Sedation; ↓ GI distress",
          tolerability_more: null,
          safety: null,
          cost: "Low",
          line_of_treatment: 1,
          initiation_dose_mg: 50,
          therapeutic_min_dose_mg: 50,
          therapeutic_max_dose_mg: 200,
          max_dose_mg: 200,
          updated_at: "2026-03-30T16:30:00.000Z",
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

    const workflowTab = screen.getByRole("tab", { name: "Pending Approvals" });
    fireEvent.mouseDown(workflowTab);
    fireEvent.click(workflowTab);

    await waitFor(() => {
      expect(workflowTab.getAttribute("aria-selected")).toBe("true");
      expect(screen.getByText("Sertraline")).toBeInTheDocument();
    });

    expect(screen.queryByText("The master row changed after this proposal was submitted. This proposal should be reviewed and resubmitted against the latest data.")).not.toBeInTheDocument();
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).not.toBeDisabled();
  });

  it("lets sub admins submit new medication proposals for approval", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "user-2",
      },
      profile: {
        role: "sub_admin",
      },
      loading: false,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    } as never);

    mockPendingQueueQuery();
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: [],
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: null,
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

    fireEvent.click(screen.getByRole("button", { name: "Add medication" }));

    await waitFor(() => {
      expect(screen.getByText("Propose new medication")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Drug name"), {
      target: { value: "Testoxetine" },
    });
    fireEvent.change(screen.getByLabelText("Change reason"), {
      target: { value: "Add a reviewed option for line 1 treatment." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenNthCalledWith(2, "submit_antidepressant_pending_add", {
        p_category_id: "category-1",
        p_drug_name: "Testoxetine",
        p_medication_type: "monotherapy",
        p_frequency: null,
        p_tolerability_less: null,
        p_tolerability_more: null,
        p_safety: null,
        p_cost: null,
        p_line_of_treatment: 1,
        p_initiation_dose_mg: null,
        p_therapeutic_min_dose_mg: null,
        p_therapeutic_max_dose_mg: null,
        p_max_dose_mg: null,
        p_change_reason: "Add a reviewed option for line 1 treatment.",
      });
    });
  });

  it("shows newly approved medication proposals in the treatment list", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "user-1",
      },
      profile: {
        role: "super_admin",
      },
      loading: false,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    } as never);

    mockPendingQueueQuery([
      {
        id: "pending-add",
        drug_id: null,
        category_id: "category-1",
        proposed_by_user_id: "user-2",
        previous_data: {},
        proposed_data: {
          drug_name: "Testoxetine",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: null,
          tolerability_more: "↑ nausea",
          safety: "↓ drug interaction",
          cost: "Low",
          line_of_treatment: 1,
          initiation_dose_mg: 10,
          therapeutic_min_dose_mg: 20,
          therapeutic_max_dose_mg: 40,
          max_dose_mg: 60,
          is_active: true,
        },
        change_reason: "Add the approved medication option.",
        status: "pending",
        review_note: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: "2026-03-30T18:00:00.000Z",
      },
    ]);

    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: [],
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: {
          id: "drug-new",
          category_id: "category-1",
          drug_name: "Testoxetine",
          medication_type: "monotherapy",
          frequency: "daily",
          tolerability_less: null,
          tolerability_more: "↑ nausea",
          safety: "↓ drug interaction",
          cost: "Low",
          line_of_treatment: 1,
          initiation_dose_mg: 10,
          therapeutic_min_dose_mg: 20,
          therapeutic_max_dose_mg: 40,
          max_dose_mg: 60,
          updated_at: "2026-03-30T18:05:00.000Z",
          is_active: true,
        },
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: [
          {
            id: "drug-new",
            category_id: "category-1",
            drug_name: "Testoxetine",
            medication_type: "monotherapy",
            frequency: "daily",
            tolerability_less: null,
            tolerability_more: "↑ nausea",
            safety: "↓ drug interaction",
            cost: "Low",
            line_of_treatment: 1,
            initiation_dose_mg: 10,
            therapeutic_min_dose_mg: 20,
            therapeutic_max_dose_mg: 40,
            max_dose_mg: 60,
            updated_at: "2026-03-30T18:05:00.000Z",
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

    const workflowTab = screen.getByRole("tab", { name: "Pending Approvals" });
    fireEvent.mouseDown(workflowTab);
    fireEvent.click(workflowTab);

    await waitFor(() => {
      expect(workflowTab.getAttribute("aria-selected")).toBe("true");
      expect(screen.getByRole("button", { name: "Approve add" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve add" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve and add" }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("approve_antidepressant_pending_edit", {
        p_pending_edit_id: "pending-add",
        p_review_note: null,
      });
    });

    const stepsTab = screen.getByRole("tab", { name: "Treatment Steps" });
    fireEvent.mouseDown(stepsTab);
    fireEvent.click(stepsTab);

    await waitFor(() => {
      expect(stepsTab.getAttribute("aria-selected")).toBe("true");
      expect(screen.getByRole("button", { name: "Line 1" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Line 1" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select medication Testoxetine" })).toBeInTheDocument();
    });
  });
});
