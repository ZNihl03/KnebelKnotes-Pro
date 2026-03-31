import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Bandage,
  Pill,
  RefreshCcw,
  PenLine,
  Trash2,
} from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/RichTextEditor";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { richTextHasContent, sanitizeRichText, toStoredRichText } from "@/lib/richText";
import { FloatingNav } from "@/components/ui/floating-navbar";
import InitiationOfTreatment from "@/pages/InitiationOfTreatment";
import AssessmentOfResponse from "@/components/AssessmentOfResponse";
import { ASSESSMENT_FIELD_DEFAULTS, AssessmentEditableField } from "@/lib/assessmentContent";
import { useUiPreferences } from "@/contexts/UiPreferencesContext";

type CategoryDetailRecord = {
  id: string;
  short_code: string;
  name: string;
  description: string | null;
  diagnosis: string | null;
  treatment: string | null;
  patient_education: string | null;
  improvement: string | null;
  reassessment: string | null;
  trial: string | null;
  assessment_initial_response: string | null;
  assessment_change_treatment: string | null;
  assessment_dose_optimization: string | null;
};

const ALL_SECTION_KEYS = [
  "diagnosis",
  "treatment",
  "patient_education",
  "improvement",
  "reassessment",
  "trial",
  "assessment_initial_response",
  "assessment_change_treatment",
  "assessment_dose_optimization",
] as const;

const VISIBLE_SECTIONS = [
  { key: "diagnosis", label: "Diagnosis", icon: ClipboardList },
  { key: "treatment", label: "Initiation of Treatment", icon: Bandage },
  { key: "reassessment", label: "Assessment of Response", icon: RefreshCcw },
  { key: "antidepressant-augment", label: "Response Optimization", icon: Pill },
] as const;

type SectionFieldKey = (typeof ALL_SECTION_KEYS)[number];
type SectionKey = (typeof VISIBLE_SECTIONS)[number]["key"];
type SectionDraft = Record<SectionFieldKey, string>;

const BASE_CATEGORY_SELECT =
  "id, short_code, name, description, diagnosis, treatment, patient_education, improvement, reassessment, trial";
const EXTENDED_CATEGORY_SELECT = `${BASE_CATEGORY_SELECT}, assessment_initial_response, assessment_change_treatment, assessment_dose_optimization`;

const isMissingAssessmentColumnError = (message?: string) =>
  [
    "assessment_initial_response",
    "assessment_change_treatment",
    "assessment_dose_optimization",
  ].some((column) => message?.includes(column));

const createSectionDraft = (
  source?: Partial<Record<SectionFieldKey, string | null | undefined>>,
): SectionDraft => ({
  diagnosis: sanitizeRichText(source?.diagnosis),
  treatment: sanitizeRichText(source?.treatment),
  patient_education: sanitizeRichText(source?.patient_education),
  improvement: sanitizeRichText(source?.improvement),
  reassessment: sanitizeRichText(source?.reassessment),
  trial: sanitizeRichText(source?.trial),
  assessment_initial_response: sanitizeRichText(source?.assessment_initial_response),
  assessment_change_treatment: sanitizeRichText(source?.assessment_change_treatment),
  assessment_dose_optimization: sanitizeRichText(source?.assessment_dose_optimization),
});

const ASSESSMENT_SECTION_FIELDS = [
  "reassessment",
  "assessment_initial_response",
  "assessment_change_treatment",
  "assessment_dose_optimization",
] as const;

type AssessmentSectionField = (typeof ASSESSMENT_SECTION_FIELDS)[number];

const isAssessmentTab = (key: SectionKey) => key === "reassessment" || key === "antidepressant-augment";

const createAssessmentEditingState = (): Record<AssessmentSectionField, boolean> => ({
  reassessment: false,
  assessment_initial_response: false,
  assessment_change_treatment: false,
  assessment_dose_optimization: false,
});

const getSectionFromHash = (hash: string): SectionKey | null => {
  const normalized = hash.replace("#", "");
  return VISIBLE_SECTIONS.some((section) => section.key === normalized) ? (normalized as SectionKey) : null;
};

const CategoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const { showCategoryIds } = useUiPreferences();
  const [category, setCategory] = useState<CategoryDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SectionKey>("diagnosis");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTreatmentNotes, setEditingTreatmentNotes] = useState(false);
  const [editingPatientEducation, setEditingPatientEducation] = useState(false);
  const [savingTreatmentSection, setSavingTreatmentSection] = useState<"treatment" | "patient_education" | null>(null);
  const [editingAssessmentSections, setEditingAssessmentSections] = useState<Record<AssessmentSectionField, boolean>>(
    createAssessmentEditingState(),
  );
  const [savingAssessmentSection, setSavingAssessmentSection] = useState<AssessmentSectionField | null>(null);
  const [assessmentResponseFieldsAvailable, setAssessmentResponseFieldsAvailable] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteTimerRef = useRef<number | null>(null);
  const deleteCountdownIntervalRef = useRef<number | null>(null);
  const deleteToastIdRef = useRef<string | number | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [draft, setDraft] = useState<SectionDraft>(createSectionDraft());

  useEffect(() => {
    let isMounted = true;

    const loadCategory = async () => {
      if (!id) return;

      let categoryData: CategoryDetailRecord | null = null;
      let queryError: { message: string } | null = null;
      let nextAssessmentResponseFieldsAvailable = true;

      const extendedResponse = await supabase
        .from("categories")
        .select(EXTENDED_CATEGORY_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (extendedResponse.error && isMissingAssessmentColumnError(extendedResponse.error.message)) {
        nextAssessmentResponseFieldsAvailable = false;

        const fallbackResponse = await supabase
          .from("categories")
          .select(BASE_CATEGORY_SELECT)
          .eq("id", id)
          .maybeSingle();

        queryError = fallbackResponse.error ? { message: fallbackResponse.error.message } : null;
        categoryData = fallbackResponse.data
          ? {
              ...fallbackResponse.data,
              assessment_initial_response: null,
              assessment_change_treatment: null,
              assessment_dose_optimization: null,
            }
          : null;
      } else {
        queryError = extendedResponse.error ? { message: extendedResponse.error.message } : null;
        categoryData = extendedResponse.data as CategoryDetailRecord | null;
      }

      if (!isMounted) return;
      setAssessmentResponseFieldsAvailable(nextAssessmentResponseFieldsAvailable);

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      if (!categoryData) {
        setCategory(null);
        setLoading(false);
        return;
      }

      setCategory(categoryData);
      setDraft(createSectionDraft(categoryData));
      setEditingAssessmentSections(createAssessmentEditingState());
      setMetaName(categoryData.name ?? "");
      setMetaDescription(categoryData.description ?? "");
      setLoading(false);
    };

    void loadCategory();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const canEdit = useMemo(
    () => !authLoading && (profile?.role === "super_admin" || profile?.role === "sub_admin"),
    [authLoading, profile?.role],
  );

  const handleJump = (key: SectionKey) => {
    setActiveTab(key);
    navigate(
      {
        pathname: location.pathname,
        hash: key,
      },
      { replace: true },
    );
  };

  const activeSection = useMemo(
    () => VISIBLE_SECTIONS.find((section) => section.key === activeTab) ?? VISIBLE_SECTIONS[0],
    [activeTab],
  );
  const activeSectionIndex = useMemo(
    () => VISIBLE_SECTIONS.findIndex((section) => section.key === activeTab),
    [activeTab],
  );
  const previousSection = activeSectionIndex > 0 ? VISIBLE_SECTIONS[activeSectionIndex - 1] : null;
  const nextSection =
    activeSectionIndex >= 0 && activeSectionIndex < VISIBLE_SECTIONS.length - 1
      ? VISIBLE_SECTIONS[activeSectionIndex + 1]
      : null;
  const activeContentField = useMemo<SectionFieldKey>(
    () => (activeTab === "antidepressant-augment" ? "reassessment" : activeTab),
    [activeTab],
  );
  const activeContent = useMemo(() => sanitizeRichText(draft[activeContentField]), [activeContentField, draft]);
  const activeContentHasValue = useMemo(() => richTextHasContent(activeContent), [activeContent]);

  useEffect(() => {
    const nextSection = getSectionFromHash(location.hash);

    if (nextSection) {
      setActiveTab(nextSection);
    }
  }, [location.hash]);

  const handleCancel = () => {
    if (!category) return;
    setDraft(createSectionDraft(category));
    setEditing(false);
  };

  const handleSave = async () => {
    if (!category) return;
    const nextDraft = createSectionDraft(draft);
    const payload = {
      diagnosis: toStoredRichText(nextDraft.diagnosis),
      treatment: toStoredRichText(nextDraft.treatment),
      patient_education: toStoredRichText(nextDraft.patient_education),
      improvement: toStoredRichText(nextDraft.improvement),
      reassessment: toStoredRichText(nextDraft.reassessment),
      trial: toStoredRichText(nextDraft.trial),
      assessment_initial_response: toStoredRichText(nextDraft.assessment_initial_response),
      assessment_change_treatment: toStoredRichText(nextDraft.assessment_change_treatment),
      assessment_dose_optimization: toStoredRichText(nextDraft.assessment_dose_optimization),
    };

    setSaving(true);
    const { error } = await supabase.from("categories").update(payload).eq("id", category.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Category updated.");
    setDraft(nextDraft);
    setCategory({
      ...category,
      ...payload,
    });
    setEditing(false);
  };

  const handleTreatmentSectionCancel = (field: "treatment" | "patient_education") => {
    if (!category) return;

    setDraft((prev) => ({
      ...prev,
      [field]: sanitizeRichText(category[field]),
    }));

    if (field === "treatment") {
      setEditingTreatmentNotes(false);
      return;
    }

    setEditingPatientEducation(false);
  };

  const handleTreatmentSectionSave = async (field: "treatment" | "patient_education") => {
    if (!category) return;

    const normalizedValue = sanitizeRichText(draft[field]);
    const payload = {
      [field]: toStoredRichText(normalizedValue),
    };

    setSavingTreatmentSection(field);
    const { error } = await supabase.from("categories").update(payload).eq("id", category.id);
    setSavingTreatmentSection(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Category updated.");
    setDraft((prev) => ({
      ...prev,
      [field]: normalizedValue,
    }));
    setCategory((prev) => (prev ? { ...prev, ...payload } : prev));

    if (field === "treatment") {
      setEditingTreatmentNotes(false);
      return;
    }

    setEditingPatientEducation(false);
  };

  const handleAssessmentSectionStartEditing = (field: AssessmentSectionField) => {
    if (field !== "reassessment" && !assessmentResponseFieldsAvailable) {
      toast.error("Run the latest assessment response migration in Supabase to edit this section.");
      return;
    }

    setDraft((prev) => {
      if (field === "reassessment" || richTextHasContent(prev[field])) {
        return prev;
      }

      return {
        ...prev,
        [field]: ASSESSMENT_FIELD_DEFAULTS[field as AssessmentEditableField],
      };
    });

    setEditingAssessmentSections((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const handleAssessmentSectionCancel = (field: AssessmentSectionField) => {
    if (!category) return;

    setDraft((prev) => ({
      ...prev,
      [field]: sanitizeRichText(category[field]),
    }));
    setEditingAssessmentSections((prev) => ({
      ...prev,
      [field]: false,
    }));
  };

  const handleAssessmentSectionSave = async (field: AssessmentSectionField) => {
    if (!category) return;
    if (field !== "reassessment" && !assessmentResponseFieldsAvailable) {
      toast.error("Run the latest assessment response migration in Supabase to save this section.");
      return;
    }

    let normalizedValue = sanitizeRichText(draft[field]);

    if (field !== "reassessment" && !richTextHasContent(normalizedValue)) {
      normalizedValue = ASSESSMENT_FIELD_DEFAULTS[field as AssessmentEditableField];
    }

    const payload = {
      [field]: toStoredRichText(normalizedValue),
    };

    setSavingAssessmentSection(field);
    const { error } = await supabase.from("categories").update(payload).eq("id", category.id);
    setSavingAssessmentSection(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Category updated.");
    setDraft((prev) => ({
      ...prev,
      [field]: normalizedValue,
    }));
    setCategory((prev) => (prev ? { ...prev, ...payload } : prev));
    setEditingAssessmentSections((prev) => ({
      ...prev,
      [field]: false,
    }));
  };

  const handleMetaSave = async () => {
    if (!category) return;
    if (!metaName.trim()) {
      toast.error("Category name is required.");
      return;
    }

    setSavingMeta(true);
    const { error } = await supabase
      .from("categories")
      .update({
        name: metaName.trim(),
        description: metaDescription.trim() || null,
      })
      .eq("id", category.id);
    setSavingMeta(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Category updated.");
    setCategory({
      ...category,
      name: metaName.trim(),
      description: metaDescription.trim() || null,
    });
    setEditingMeta(false);
  };

  const handleMetaCancel = () => {
    if (!category) return;
    setMetaName(category.name ?? "");
    setMetaDescription(category.description ?? "");
    setEditingMeta(false);
  };

  const executeDelete = async () => {
    if (!category) return;
    setDeleting(true);
    const { data, error } = await supabase.from("categories").delete().eq("id", category.id).select("id");
    setDeleting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("Delete failed. Check your permissions.");
      return;
    }

    toast.success("Category deleted.");
    navigate("/categories", { replace: true });
  };

  const clearDeleteCountdown = () => {
    if (deleteTimerRef.current) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }

    if (deleteCountdownIntervalRef.current) {
      window.clearInterval(deleteCountdownIntervalRef.current);
      deleteCountdownIntervalRef.current = null;
    }
  };

  const dismissDeleteToast = () => {
    if (deleteToastIdRef.current !== null) {
      toast.dismiss(deleteToastIdRef.current);
      deleteToastIdRef.current = null;
    }
  };

  const showDeleteToast = (secondsRemaining: number) => {
    deleteToastIdRef.current = toast(
      `Category will be deleted in ${secondsRemaining} second${secondsRemaining === 1 ? "" : "s"}.`,
      {
        id: deleteToastIdRef.current ?? undefined,
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
        style: {
          backgroundColor: "hsl(var(--destructive))",
          color: "hsl(var(--destructive-foreground))",
          border: "1px solid hsl(var(--destructive))",
        },
        action: {
          label: "Undo",
          onClick: cancelDelete,
        },
        actionButtonStyle: {
          backgroundColor: "#ffffff",
          color: "hsl(var(--destructive))",
          border: "1px solid #ffffff",
          fontWeight: 700,
        },
      },
    );
  };

  const cancelDelete = () => {
    clearDeleteCountdown();
    dismissDeleteToast();
    setPendingDelete(false);
    toast.message("Deletion canceled.");
  };

  const scheduleDelete = () => {
    if (!category || pendingDelete) return;

    clearDeleteCountdown();
    dismissDeleteToast();
    setDeleteDialogOpen(false);
    setPendingDelete(true);

    let secondsRemaining = 5;
    showDeleteToast(secondsRemaining);

    deleteCountdownIntervalRef.current = window.setInterval(() => {
      secondsRemaining -= 1;

      if (secondsRemaining > 0) {
        showDeleteToast(secondsRemaining);
        return;
      }

      if (deleteCountdownIntervalRef.current) {
        window.clearInterval(deleteCountdownIntervalRef.current);
        deleteCountdownIntervalRef.current = null;
      }
    }, 1000);

    deleteTimerRef.current = window.setTimeout(() => {
      clearDeleteCountdown();
      dismissDeleteToast();
      setPendingDelete(false);
      void executeDelete();
    }, 5000);
  };

  useEffect(() => {
    return () => {
      clearDeleteCountdown();
      dismissDeleteToast();
    };
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="container py-20 text-center text-sm text-muted-foreground">Loading category...</div>
      </Layout>
    );
  }

  if (!category) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Category not found</h1>
          <Link to="/categories" className="mt-4 inline-block text-sm text-primary hover:underline">
            ← Back to categories
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pb-16 sm:pb-10">
        <div className="container py-6 sm:py-8">
          <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/categories" className="hover:text-foreground transition-colors">
              Categories
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">
              {category.name}
              {showCategoryIds ? ` (${category.short_code})` : ""}
            </span>
          </nav>

          <div className="mb-4 space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-[var(--card-shadow)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                {showCategoryIds && (
                  <div className="inline-flex rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {category.short_code}
                  </div>
                )}
                {editingMeta ? (
                  <input
                    value={metaName}
                    onChange={(event) => setMetaName(event.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-auto sm:min-w-[280px] sm:text-lg"
                    placeholder="Category name"
                  />
                ) : (
                  <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{category.name}</h1>
                )}

                {editingMeta ? (
                  <Textarea
                    value={metaDescription}
                    onChange={(event) => setMetaDescription(event.target.value)}
                    placeholder="Category description (optional)"
                    rows={3}
                    className="max-w-2xl text-base"
                  />
                ) : (
                  <p className="text-[15px] text-muted-foreground sm:text-base">
                    {category.description || "No description provided yet."}
                  </p>
                )}
              </div>

              {canEdit && !editingMeta && (
                <button
                  type="button"
                  onClick={() => setEditingMeta(true)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Edit category details"
                >
                  <PenLine className="h-4 w-4" />
                </button>
              )}
            </div>

            {editingMeta && canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          disabled={pendingDelete || deleting}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/40 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Delete category"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this category?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will schedule deletion. You can undo within 5 seconds.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={scheduleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleMetaCancel}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleMetaSave}
                  disabled={savingMeta}
                  className="w-full sm:w-auto"
                >
                  {savingMeta ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <FloatingNav
          position="fixed"
          orientation="horizontal"
          placement="center"
          className="bottom-4 sm:top-20 sm:bottom-auto"
          navItems={[
            {
              name: "Diagnosis",
              link: "#diagnosis",
              icon: <ClipboardList className="h-4 w-4" />,
            },
            {
              name: "Initiation of Treatment",
              link: "#treatment",
              icon: <Bandage className="h-4 w-4" />,
            },
            {
              name: "Assessment of Response",
              link: "#reassessment",
              icon: <RefreshCcw className="h-4 w-4" />,
            },
            {
              name: "Antidepressant Augment",
              link: "#antidepressant-augment",
              icon: <Pill className="h-4 w-4" />,
            },
          ]}
          activeLink={`#${activeTab}`}
          onNavigate={(link) => handleJump(link.replace("#", "") as SectionKey)}
        />

        {error && (
          <div className="container mt-6">
            <div className="rounded-2xl border border-border/70 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        <div className="container py-5">
          <section
            className={
              activeTab === "treatment"
                ? ""
                : "rounded-2xl border border-border/70 bg-card/70 p-4 shadow-[var(--card-shadow)] sm:p-6"
            }
          >
            {activeTab !== "treatment" && !isAssessmentTab(activeTab) && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="font-display text-xl font-semibold text-foreground">{activeSection.label}</h2>
                {canEdit &&
                  (editing ? (
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleCancel}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full sm:w-auto"
                      >
                        {saving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setEditing(true)}
                      className="w-full gap-2 sm:w-auto"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  ))}
              </div>
            )}
            <div className={activeTab === "treatment" ? "" : "mt-3"}>
              {activeTab === "treatment" ? (
                <InitiationOfTreatment
                  categoryId={category.id}
                  categoryName={category.name}
                  factorsContent={draft.treatment}
                  patientEducationContent={draft.patient_education}
                  canEditContent={canEdit}
                  isEditingFactors={editingTreatmentNotes}
                  isSavingFactors={savingTreatmentSection === "treatment"}
                  onStartEditingFactors={() => setEditingTreatmentNotes(true)}
                  onCancelEditingFactors={() => handleTreatmentSectionCancel("treatment")}
                  onSaveFactors={() => void handleTreatmentSectionSave("treatment")}
                  isEditingPatientEducation={editingPatientEducation}
                  isSavingPatientEducation={savingTreatmentSection === "patient_education"}
                  onStartEditingPatientEducation={() => setEditingPatientEducation(true)}
                  onCancelEditingPatientEducation={() => handleTreatmentSectionCancel("patient_education")}
                  onSavePatientEducation={() => void handleTreatmentSectionSave("patient_education")}
                  onFactorsContentChange={(value) => setDraft((prev) => ({ ...prev, treatment: value }))}
                  onPatientEducationContentChange={(value) =>
                    setDraft((prev) => ({ ...prev, patient_education: value }))
                  }
                />
              ) : isAssessmentTab(activeTab) ? (
                <AssessmentOfResponse
                  notesSection={{
                    content: draft.reassessment,
                    canEdit,
                    isEditing: editingAssessmentSections.reassessment,
                    isSaving: savingAssessmentSection === "reassessment",
                    onStartEditing: () => handleAssessmentSectionStartEditing("reassessment"),
                    onCancelEditing: () => handleAssessmentSectionCancel("reassessment"),
                    onSave: () => void handleAssessmentSectionSave("reassessment"),
                    onContentChange: (value) => setDraft((prev) => ({ ...prev, reassessment: value })),
                  }}
                  initialResponseSection={{
                    content: draft.assessment_initial_response,
                    canEdit,
                    isEditing: editingAssessmentSections.assessment_initial_response,
                    isSaving: savingAssessmentSection === "assessment_initial_response",
                    onStartEditing: () => handleAssessmentSectionStartEditing("assessment_initial_response"),
                    onCancelEditing: () => handleAssessmentSectionCancel("assessment_initial_response"),
                    onSave: () => void handleAssessmentSectionSave("assessment_initial_response"),
                    onContentChange: (value) =>
                      setDraft((prev) => ({ ...prev, assessment_initial_response: value })),
                  }}
                  changeTreatmentSection={{
                    content: draft.assessment_change_treatment,
                    canEdit,
                    isEditing: editingAssessmentSections.assessment_change_treatment,
                    isSaving: savingAssessmentSection === "assessment_change_treatment",
                    onStartEditing: () => handleAssessmentSectionStartEditing("assessment_change_treatment"),
                    onCancelEditing: () => handleAssessmentSectionCancel("assessment_change_treatment"),
                    onSave: () => void handleAssessmentSectionSave("assessment_change_treatment"),
                    onContentChange: (value) =>
                      setDraft((prev) => ({ ...prev, assessment_change_treatment: value })),
                  }}
                  doseOptimizationSection={{
                    content: draft.assessment_dose_optimization,
                    canEdit,
                    isEditing: editingAssessmentSections.assessment_dose_optimization,
                    isSaving: savingAssessmentSection === "assessment_dose_optimization",
                    onStartEditing: () => handleAssessmentSectionStartEditing("assessment_dose_optimization"),
                    onCancelEditing: () => handleAssessmentSectionCancel("assessment_dose_optimization"),
                    onSave: () => void handleAssessmentSectionSave("assessment_dose_optimization"),
                    onContentChange: (value) =>
                      setDraft((prev) => ({ ...prev, assessment_dose_optimization: value })),
                  }}
                  notesOnly={activeTab === "antidepressant-augment"}
                />
              ) : editing ? (
                <RichTextEditor
                  key={activeTab}
                  value={draft[activeTab]}
                  onChange={(value) => setDraft((prev) => ({ ...prev, [activeTab]: value }))}
                  placeholder={`Add ${activeSection.label.toLowerCase()} notes...`}
                />
              ) : (
                <>
                  {activeContentHasValue ? (
                    <div
                      className="rich-text-content text-[15px] leading-relaxed text-muted-foreground sm:text-base"
                      dangerouslySetInnerHTML={{ __html: activeContent }}
                    />
                  ) : (
                    <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                      No information yet.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-[var(--card-shadow)] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Tab {activeSectionIndex + 1} of {VISIBLE_SECTIONS.length}: {activeSection.label}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => previousSection && handleJump(previousSection.key)}
                  disabled={!previousSection}
                  className="w-full sm:w-auto"
                  aria-label={previousSection ? `Back: ${previousSection.label}` : "Back"}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {previousSection ? `Back: ${previousSection.label}` : "Back"}
                </Button>
                <Button
                  type="button"
                  onClick={() => nextSection && handleJump(nextSection.key)}
                  disabled={!nextSection}
                  className="w-full sm:w-auto"
                  aria-label={nextSection ? `Next: ${nextSection.label}` : "Next"}
                >
                  {nextSection ? `Next: ${nextSection.label}` : "Next"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default CategoryDetail;
