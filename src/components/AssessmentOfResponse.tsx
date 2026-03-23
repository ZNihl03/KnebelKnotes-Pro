import { useMemo, useState } from "react";
import { ChevronDown, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import RichTextEditor from "@/components/RichTextEditor";
import { richTextHasContent, sanitizeRichText } from "@/lib/richText";
import { AssessmentEditableField, getAssessmentDisplayContent } from "@/lib/assessmentContent";
import tableThreePointTwoImage from "@/assets/table3.2.png";

type EditableAssessmentSection = {
  content: string;
  canEdit: boolean;
  isEditing: boolean;
  isSaving: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSave: () => void;
  onContentChange: (value: string) => void;
};

type AssessmentOfResponseProps = {
  notesSection: EditableAssessmentSection;
  initialResponseSection: EditableAssessmentSection;
  changeTreatmentSection: EditableAssessmentSection;
  doseOptimizationSection: EditableAssessmentSection;
  notesOnly?: boolean;
};

type ResponseScenario = "" | "persistent_tolerability" | "less_than_20" | "greater_or_equal_20";

const shouldShowChangeTreatmentStep = (scenario: ResponseScenario) =>
  scenario === "persistent_tolerability" || scenario === "less_than_20";
const shouldShowDoseOptimizationStep = (scenario: ResponseScenario) => scenario === "greater_or_equal_20";

const cardBodyClassName = "text-[15px] leading-relaxed text-muted-foreground sm:text-base";

const AssessmentOfResponse = ({
  notesSection,
  initialResponseSection,
  changeTreatmentSection,
  doseOptimizationSection,
  notesOnly = false,
}: AssessmentOfResponseProps) => {
  const [scenario, setScenario] = useState<ResponseScenario>("");
  const normalizedNotesContent = useMemo(() => sanitizeRichText(notesSection.content), [notesSection.content]);
  const hasNotes = useMemo(() => richTextHasContent(normalizedNotesContent), [normalizedNotesContent]);
  const showChangeTreatmentStep = shouldShowChangeTreatmentStep(scenario);
  const showDoseOptimizationStep = shouldShowDoseOptimizationStep(scenario);
  const displayInitialResponseContent = useMemo(
    () => getAssessmentDisplayContent("assessment_initial_response", initialResponseSection.content),
    [initialResponseSection.content],
  );
  const displayChangeTreatmentContent = useMemo(
    () => getAssessmentDisplayContent("assessment_change_treatment", changeTreatmentSection.content),
    [changeTreatmentSection.content],
  );
  const displayDoseOptimizationContent = useMemo(
    () => getAssessmentDisplayContent("assessment_dose_optimization", doseOptimizationSection.content),
    [doseOptimizationSection.content],
  );

  const renderCardActions = (section: EditableAssessmentSection) => {
    if (!section.canEdit) return null;

    if (section.isEditing) {
      return (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="secondary" size="sm" onClick={section.onCancelEditing} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={section.onSave} disabled={section.isSaving} className="w-full sm:w-auto">
            {section.isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      );
    }

    return (
      <Button type="button" size="sm" onClick={section.onStartEditing} className="w-full gap-2 sm:w-auto">
        <PenLine className="h-3.5 w-3.5" />
        Edit
      </Button>
    );
  };

  const renderEditableCardContent = (
    field: AssessmentEditableField,
    section: EditableAssessmentSection,
    displayContent: string,
  ) => {
    if (section.isEditing) {
      return (
        <RichTextEditor
          value={section.content}
          onChange={section.onContentChange}
          placeholder={`Add ${field.replaceAll("_", " ")} content...`}
        />
      );
    }

    return (
      <div
        className={`rich-text-content ${cardBodyClassName}`}
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
    );
  };

  const renderResponsePatternSelector = () => (
    <div className="max-w-xl space-y-2">
      <label htmlFor="assessment-response-scenario" className="text-sm font-medium text-foreground">
        Current response pattern
      </label>
      <div className="relative">
        <select
          id="assessment-response-scenario"
          value={scenario}
          onChange={(event) => setScenario(event.target.value as ResponseScenario)}
          className="flex h-11 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-10 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">Select an option</option>
          <option value="persistent_tolerability">Persistent issues with tolerability</option>
          <option value="less_than_20">If &lt;20% reduction</option>
          <option value="greater_or_equal_20">If ≥20% reduction</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );

  const notesCard = (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-[var(--card-shadow)] sm:p-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Notes
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">
            Additional assessment notes
          </h3>
        </div>
        {renderCardActions(notesSection)}
      </div>

      {notesSection.isEditing ? (
        <RichTextEditor
          value={notesSection.content}
          onChange={notesSection.onContentChange}
          placeholder="Add assessment of response notes..."
        />
      ) : hasNotes ? (
        <div
          className={`rich-text-content ${cardBodyClassName}`}
          dangerouslySetInnerHTML={{ __html: normalizedNotesContent }}
        />
      ) : (
        <p className={cardBodyClassName}>No information yet.</p>
      )}
    </div>
  );

  if (notesOnly) {
    return <div className="space-y-4">{notesCard}</div>;
  }

  return (
    <div className="space-y-4">
      {notesCard}

      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-[var(--card-shadow)] sm:p-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                3.1.1
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">
                Assessment of initial response
              </h3>
            </div>
            {renderCardActions(initialResponseSection)}
          </div>

          {renderEditableCardContent(
            "assessment_initial_response",
            initialResponseSection,
            displayInitialResponseContent,
          )}

          {renderResponsePatternSelector()}
        </div>
      </div>

      {showChangeTreatmentStep && (
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-[var(--card-shadow)] sm:p-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  3.1.2
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">
                  Assess for change of treatment
                </h3>
              </div>
              {renderCardActions(changeTreatmentSection)}
            </div>

            {renderEditableCardContent(
              "assessment_change_treatment",
              changeTreatmentSection,
              displayChangeTreatmentContent,
            )}

            <figure className="space-y-3">
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="group block w-fit rounded-2xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label="Open Table 3.2"
                  >
                    <img
                      src={tableThreePointTwoImage}
                      alt="Table 3.2"
                      className="h-28 w-auto rounded-2xl border border-border/70 object-contain shadow-[var(--card-shadow)] transition-transform group-hover:scale-[1.02]"
                    />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl border-border/70 bg-card p-4 sm:p-6">
                  <DialogHeader>
                    <DialogTitle>Table 3.2</DialogTitle>
                    <DialogDescription>Expanded view of the psychotherapy reference table.</DialogDescription>
                  </DialogHeader>
                  <img
                    src={tableThreePointTwoImage}
                    alt="Table 3.2 enlarged"
                    className="max-h-[75vh] w-full rounded-2xl border border-border/70 object-contain"
                  />
                </DialogContent>
              </Dialog>
              <figcaption className="text-sm font-medium text-muted-foreground">Table 3.2</figcaption>
            </figure>
          </div>
        </div>
      )}

      {showDoseOptimizationStep && (
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-[var(--card-shadow)] sm:p-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  3.2
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">
                  Dose optimization
                </h3>
              </div>
              {renderCardActions(doseOptimizationSection)}
            </div>

            {renderEditableCardContent(
              "assessment_dose_optimization",
              doseOptimizationSection,
              displayDoseOptimizationContent,
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentOfResponse;
