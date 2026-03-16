import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AssessmentOfResponse from "@/components/AssessmentOfResponse";

describe("AssessmentOfResponse", () => {
  const createSectionProps = () => ({
    content: "",
    canEdit: true,
    isEditing: false,
    isSaving: false,
    onStartEditing: () => undefined,
    onCancelEditing: () => undefined,
    onSave: () => undefined,
    onContentChange: () => undefined,
  });

  it("shows the change of treatment step for persistent tolerability and low response selections", () => {
    render(
      <AssessmentOfResponse
        notesSection={createSectionProps()}
        initialResponseSection={createSectionProps()}
        changeTreatmentSection={createSectionProps()}
        doseOptimizationSection={createSectionProps()}
      />,
    );

    const scenarioSelect = screen.getByLabelText("Current response pattern");

    expect(screen.queryByText("Assess for change of treatment")).not.toBeInTheDocument();

    fireEvent.change(scenarioSelect, { target: { value: "persistent_tolerability" } });

    expect(screen.getByText("Assess for change of treatment")).toBeInTheDocument();
    expect(screen.getByText("Increase dose (see Step 3.2)")).toBeInTheDocument();
    expect(screen.getByText("Table 3.2")).toBeInTheDocument();
    expect(screen.getByAltText("Table 3.2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Table 3.2" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText("Table 3.2 enlarged")).toBeInTheDocument();

    fireEvent.change(scenarioSelect, { target: { value: "greater_or_equal_20" } });

    expect(screen.queryByText("Assess for change of treatment")).not.toBeInTheDocument();
    expect(screen.getByText("Dose optimization")).toBeInTheDocument();
    expect(screen.getByText("After completing initial trial (6-8 weeks @ a therapeutic dose)...")).toBeInTheDocument();
    expect(screen.getByText("If <20% reduction of symptoms, go back to 3.1.2")).toBeInTheDocument();
    expect(screen.getByText("Optimize dose to maximize symptom reduction")).toBeInTheDocument();

    fireEvent.change(scenarioSelect, { target: { value: "less_than_20" } });

    expect(screen.queryByText("Dose optimization")).not.toBeInTheDocument();
    expect(screen.getByText("Assess for change of treatment")).toBeInTheDocument();
    expect(screen.getByText("Switch to agent of superiority (see Step 4.1)")).toBeInTheDocument();
  });
});
