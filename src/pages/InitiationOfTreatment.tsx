import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { z } from "zod";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileClock,
  Loader2,
  PencilLine,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import RichTextEditor from "@/components/RichTextEditor";
import { formatDoseMg, formatDoseRangeMg } from "@/lib/treatmentProgression";
import { richTextHasContent } from "@/lib/richText";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AntidepressantMasterRow = {
  id: string;
  category_id: string;
  drug_name: string;
  medication_type: string;
  frequency: string | null;
  line_of_treatment: number;
  initiation_dose_mg: number | null;
  therapeutic_min_dose_mg: number | null;
  therapeutic_max_dose_mg: number | null;
  max_dose_mg: number | null;
  updated_at: string;
  is_active: boolean;
};

type AntidepressantSnapshot = Pick<
  AntidepressantMasterRow,
  | "drug_name"
  | "medication_type"
  | "frequency"
  | "line_of_treatment"
  | "initiation_dose_mg"
  | "therapeutic_min_dose_mg"
  | "therapeutic_max_dose_mg"
  | "max_dose_mg"
>;

type AuditLogRow = {
  id: string;
  drug_id: string;
  changed_by_user_id: string;
  previous_data: Partial<AntidepressantSnapshot>;
  new_data: AntidepressantSnapshot;
  change_reason: string;
  created_at: string;
  changed_by_label?: string;
};

type PendingStatus = "pending" | "approved" | "rejected";

type PendingEditRow = {
  id: string;
  drug_id: string;
  category_id: string;
  proposed_by_user_id: string;
  previous_data: AntidepressantSnapshot;
  proposed_data: AntidepressantSnapshot;
  change_reason: string;
  status: PendingStatus;
  review_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  proposed_by_label?: string;
  reviewed_by_label?: string;
};

type EditFormState = {
  drug_name: string;
  medication_type: string;
  frequency: string;
  line_of_treatment: string;
  initiation_dose_mg: string;
  therapeutic_min_dose_mg: string;
  therapeutic_max_dose_mg: string;
  max_dose_mg: string;
  change_reason: string;
};

type ReviewAction = "approve" | "reject";

const optionalDoseField = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isNaN(numericValue) ? value : numericValue;
}, z.number().int("Use a whole-number dose.").min(0, "Use a non-negative integer dose.").nullable());

const editSchema = z
  .object({
    drug_name: z.string().trim().min(1, "Drug name is required."),
    medication_type: z.string().trim().min(1, "Medication type is required."),
    frequency: z.string().trim().max(100, "Frequency is too long."),
    line_of_treatment: z.coerce.number().int().min(1, "Line must be 1, 2, or 3.").max(3, "Line must be 1, 2, or 3."),
    initiation_dose_mg: optionalDoseField,
    therapeutic_min_dose_mg: optionalDoseField,
    therapeutic_max_dose_mg: optionalDoseField,
    max_dose_mg: optionalDoseField,
    change_reason: z.string().trim().min(10, "Explain why this change is being made."),
  })
  .superRefine((data, ctx) => {
    const doseValues = [
      data.initiation_dose_mg,
      data.therapeutic_min_dose_mg,
      data.therapeutic_max_dose_mg,
      data.max_dose_mg,
    ];
    const populatedDoseCount = doseValues.filter((value) => value !== null).length;

    if (populatedDoseCount !== 0 && populatedDoseCount !== doseValues.length) {
      ([
        "initiation_dose_mg",
        "therapeutic_min_dose_mg",
        "therapeutic_max_dose_mg",
        "max_dose_mg",
      ] as const).forEach((field) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Provide all four dose values or leave all of them blank.",
        });
      });
      return;
    }

    if (populatedDoseCount === 0) {
      return;
    }

    if (data.therapeutic_min_dose_mg! < data.initiation_dose_mg!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["therapeutic_min_dose_mg"],
        message: "Therapeutic minimum should be at or above the initiation dose.",
      });
    }

    if (data.therapeutic_max_dose_mg! < data.therapeutic_min_dose_mg!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["therapeutic_max_dose_mg"],
        message: "Therapeutic maximum must be greater than or equal to the therapeutic minimum.",
      });
    }

    if (data.max_dose_mg! < data.therapeutic_max_dose_mg!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max_dose_mg"],
        message: "Maximum dose must be greater than or equal to the therapeutic maximum.",
      });
    }
  });

const AUDITED_FIELDS: Array<{ key: keyof AntidepressantSnapshot; label: string }> = [
  { key: "drug_name", label: "Drug name" },
  { key: "medication_type", label: "Medication type" },
  { key: "frequency", label: "Frequency" },
  { key: "line_of_treatment", label: "Line of treatment" },
  { key: "initiation_dose_mg", label: "Initiation dose" },
  { key: "therapeutic_min_dose_mg", label: "Therapeutic minimum dose" },
  { key: "therapeutic_max_dose_mg", label: "Therapeutic maximum dose" },
  { key: "max_dose_mg", label: "Maximum dose" },
];

const TREATMENT_LINES = [1, 2, 3] as const;

const emptyForm: EditFormState = {
  drug_name: "",
  medication_type: "monotherapy",
  frequency: "",
  line_of_treatment: "1",
  initiation_dose_mg: "",
  therapeutic_min_dose_mg: "",
  therapeutic_max_dose_mg: "",
  max_dose_mg: "",
  change_reason: "",
};

const toEditForm = (row: AntidepressantMasterRow): EditFormState => ({
  drug_name: row.drug_name,
  medication_type: row.medication_type,
  frequency: row.frequency ?? "",
  line_of_treatment: String(row.line_of_treatment),
  initiation_dose_mg: row.initiation_dose_mg === null ? "" : String(row.initiation_dose_mg),
  therapeutic_min_dose_mg: row.therapeutic_min_dose_mg === null ? "" : String(row.therapeutic_min_dose_mg),
  therapeutic_max_dose_mg: row.therapeutic_max_dose_mg === null ? "" : String(row.therapeutic_max_dose_mg),
  max_dose_mg: row.max_dose_mg === null ? "" : String(row.max_dose_mg),
  change_reason: "",
});

const toSnapshot = (row: AntidepressantMasterRow): AntidepressantSnapshot => ({
  drug_name: row.drug_name,
  medication_type: row.medication_type,
  frequency: row.frequency,
  line_of_treatment: row.line_of_treatment,
  initiation_dose_mg: row.initiation_dose_mg,
  therapeutic_min_dose_mg: row.therapeutic_min_dose_mg,
  therapeutic_max_dose_mg: row.therapeutic_max_dose_mg,
  max_dose_mg: row.max_dose_mg,
});

const formatTimestamp = (value: string) => format(new Date(value), "MMM d, yyyy h:mm a");

const buildActorLabel = (profile: { full_name: string | null; username: string | null; email: string | null } | null) =>
  profile?.full_name || profile?.username || profile?.email || "Unknown editor";

const normalizeTreatmentModuleError = (message: string) => {
  const hasMissingCategoryScopeColumn =
    message.includes("column") &&
    ["antidepressant_master.category_id", "pending_antidepressant_edits.category_id"].some((name) =>
      message.includes(name),
    );
  const hasMissingMetadataColumn =
    message.includes("column") &&
    [
      "antidepressant_master.medication_type",
      "antidepressant_master.frequency",
      "pending_antidepressant_edits.category_id",
    ].some((name) => message.includes(name));
  const hasSchemaCacheMiss =
    message.includes("schema cache") &&
    [
      "public.antidepressant_master",
      "public.pending_antidepressant_edits",
      "public.edit_audit_log",
      "public.get_category_treatment_rows",
      "public.create_antidepressant_with_audit",
      "public.update_antidepressant_with_audit",
      "public.submit_antidepressant_pending_edit",
      "public.approve_antidepressant_pending_edit",
      "public.reject_antidepressant_pending_edit",
    ].some((name) => message.includes(name));

  if (!hasSchemaCacheMiss && !hasMissingCategoryScopeColumn && !hasMissingMetadataColumn) {
    return message;
  }

  return "The latest Initiation of Treatment Supabase migrations are not installed yet. Apply the treatment migrations in supabase/migrations, including the category-scope and metadata updates, then reload this page.";
};

const getStatusVariant = (status: PendingStatus) => {
  if (status === "approved") return "secondary" as const;
  if (status === "rejected") return "destructive" as const;
  return "outline" as const;
};

const snapshotsMatch = (left: AntidepressantSnapshot | null | undefined, right: AntidepressantSnapshot | null | undefined) =>
  AUDITED_FIELDS.every(({ key }) => left?.[key] === right?.[key]);

const formatSnapshotValue = (
  snapshot: Partial<AntidepressantSnapshot> | AntidepressantSnapshot,
  key: keyof AntidepressantSnapshot,
) => {
  const value = snapshot[key];

  if (value === undefined || value === null || value === "") {
    return "Not set";
  }

  if (key === "drug_name") {
    return value;
  }

  if (key === "medication_type") {
    return String(value).replace(/_/g, " ");
  }

  if (key === "frequency") {
    return value;
  }

  if (key === "line_of_treatment") {
    return `Line ${value}`;
  }

  return formatDoseMg(value as number);
};

const formatMedicationType = (value: string) => value.replace(/_/g, " ");

const formatDoseCellValue = (value: number | null) => (value === null ? "Not set" : formatDoseMg(value));

const formatDoseRangeCellValue = (min: number | null, max: number | null) =>
  min === null || max === null ? "Not set" : formatDoseRangeMg(min, max);

type InitiationOfTreatmentProps = {
  categoryId: string;
  categoryName?: string;
  factorsContent?: string;
  patientEducationContent?: string;
  canEditContent?: boolean;
  isEditingFactors?: boolean;
  isSavingFactors?: boolean;
  onStartEditingFactors?: () => void;
  onCancelEditingFactors?: () => void;
  onSaveFactors?: () => void;
  isEditingPatientEducation?: boolean;
  isSavingPatientEducation?: boolean;
  onStartEditingPatientEducation?: () => void;
  onCancelEditingPatientEducation?: () => void;
  onSavePatientEducation?: () => void;
  onFactorsContentChange?: (value: string) => void;
  onPatientEducationContentChange?: (value: string) => void;
};

const InitiationOfTreatment = ({
  categoryId,
  categoryName,
  factorsContent = "",
  patientEducationContent = "",
  canEditContent = false,
  isEditingFactors = false,
  isSavingFactors = false,
  onStartEditingFactors,
  onCancelEditingFactors,
  onSaveFactors,
  isEditingPatientEducation = false,
  isSavingPatientEducation = false,
  onStartEditingPatientEducation,
  onCancelEditingPatientEducation,
  onSavePatientEducation,
  onFactorsContentChange,
  onPatientEducationContentChange,
}: InitiationOfTreatmentProps) => {
  const { user, profile, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<AntidepressantMasterRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [pendingRows, setPendingRows] = useState<PendingEditRow[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AntidepressantMasterRow | null>(null);
  const [form, setForm] = useState<EditFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EditFormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<AntidepressantMasterRow | null>(null);
  const [historyRows, setHistoryRows] = useState<AuditLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<PendingEditRow | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction>("approve");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [selectedLine, setSelectedLine] = useState("");
  const [selectedMedicationId, setSelectedMedicationId] = useState("");
  const [isLineTableCollapsed, setIsLineTableCollapsed] = useState(false);
  const medicationSelectionSectionRef = useRef<HTMLElement | null>(null);

  const canApprove = profile?.role === "super_admin";
  const canPropose = profile?.role === "sub_admin";
  const canEditRows = canApprove || canPropose;
  const canViewHistory = Boolean(user);
  const canViewUpdatedAt = Boolean(user);
  const canTrackPending = canApprove || canPropose;
  const showActionColumn = canViewHistory || canEditRows;

  const loadRows = useCallback(async () => {
    if (!categoryId) {
      setRows([]);
      setRowsError(null);
      setLoadingRows(false);
      return;
    }

    setLoadingRows(true);
    const { data, error } = await supabase.rpc("get_category_treatment_rows", {
      p_category_id: categoryId,
    });

    if (error) {
      setRowsError(normalizeTreatmentModuleError(error.message));
      setRows([]);
    } else {
      setRows((data as AntidepressantMasterRow[] | null) ?? []);
      setRowsError(null);
    }

    setLoadingRows(false);
  }, [categoryId]);

  const loadPendingRows = useCallback(async () => {
    if (!user || !canTrackPending || !categoryId) {
      setPendingRows([]);
      setLoadingPending(false);
      return;
    }

    setLoadingPending(true);
    let query = supabase
      .from("pending_antidepressant_edits")
      .select(
        "id, drug_id, category_id, proposed_by_user_id, previous_data, proposed_data, change_reason, status, review_note, reviewed_by_user_id, reviewed_at, created_at",
      )
      .eq("category_id", categoryId)
      .order("created_at", { ascending: false });

    if (canPropose && !canApprove) {
      query = query.eq("proposed_by_user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      setPendingRows([]);
      setPendingError(normalizeTreatmentModuleError(error.message));
      setLoadingPending(false);
      return;
    }

    const baseRows = ((data as PendingEditRow[] | null) ?? []).map((item) => ({
      ...item,
      proposed_by_label: "Unknown editor",
      reviewed_by_label: item.reviewed_by_user_id ? "Unknown reviewer" : null,
    }));

    const actorIds = Array.from(
      new Set(
        baseRows
          .flatMap((item) => [item.proposed_by_user_id, item.reviewed_by_user_id])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (actorIds.length === 0) {
      setPendingRows(baseRows);
      setPendingError(null);
      setLoadingPending(false);
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, username, email")
      .in("id", actorIds);

    if (profileError) {
      setPendingRows(baseRows);
      setPendingError(null);
      setLoadingPending(false);
      return;
    }

    const profileMap = new Map(
      ((profileRows as Array<{ id: string; full_name: string | null; username: string | null; email: string | null }> | null) ?? []).map(
        (item) => [item.id, item],
      ),
    );

    setPendingRows(
      baseRows.map((item) => ({
        ...item,
        proposed_by_label: buildActorLabel(profileMap.get(item.proposed_by_user_id) ?? null),
        reviewed_by_label: item.reviewed_by_user_id
          ? buildActorLabel(profileMap.get(item.reviewed_by_user_id) ?? null)
          : null,
      })),
    );
    setPendingError(null);
    setLoadingPending(false);
  }, [canApprove, canPropose, canTrackPending, categoryId, user]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void loadPendingRows();
  }, [authLoading, loadPendingRows]);

  const groupedRows = useMemo(() => {
    const groups = TREATMENT_LINES.reduce<Record<number, AntidepressantMasterRow[]>>((acc, line) => {
      acc[line] = [];
      return acc;
    }, {});

    rows.forEach((row) => {
      groups[row.line_of_treatment] ??= [];
      groups[row.line_of_treatment].push(row);
    });

    return groups;
  }, [rows]);

  const masterRowMap = useMemo(() => {
    return new Map(rows.map((row) => [row.id, row]));
  }, [rows]);

  const selectedLineRows = useMemo(() => {
    if (!selectedLine) {
      return [];
    }

    return groupedRows[Number(selectedLine)] ?? [];
  }, [groupedRows, selectedLine]);

  const selectedMedication = useMemo(
    () => selectedLineRows.find((row) => row.id === selectedMedicationId) ?? null,
    [selectedLineRows, selectedMedicationId],
  );
  const factorsContentHasValue = useMemo(() => richTextHasContent(factorsContent), [factorsContent]);
  const patientEducationContentHasValue = useMemo(
    () => richTextHasContent(patientEducationContent),
    [patientEducationContent],
  );

  const handleLineChange = (value: string) => {
    setSelectedLine(value);
    setSelectedMedicationId("");
    setIsLineTableCollapsed(false);
  };

  const handleMedicationSelection = useCallback((value: string, shouldScroll = false) => {
    setSelectedMedicationId(value);

    if (shouldScroll) {
      medicationSelectionSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

  const openEditDialog = (row: AntidepressantMasterRow) => {
    if (!canEditRows) {
      return;
    }

    setSelectedRow(row);
    setForm(toEditForm(row));
    setFormErrors({});
    setEditOpen(true);
  };

  const openCreateDialog = () => {
    if (!canApprove) {
      return;
    }

    setSelectedRow(null);
    setForm(emptyForm);
    setFormErrors({});
    setEditOpen(true);
  };

  const openReviewDialog = (item: PendingEditRow, action: ReviewAction) => {
    if (!canApprove) {
      return;
    }

    setReviewTarget(item);
    setReviewAction(action);
    setReviewNote("");
    setReviewOpen(true);
  };

  const loadHistory = async (row: AntidepressantMasterRow) => {
    if (!user) {
      toast.error("Sign in to view audit history.");
      return;
    }

    setHistoryTarget(row);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);

    const { data, error } = await supabase
      .from("edit_audit_log")
      .select("id, drug_id, changed_by_user_id, previous_data, new_data, change_reason, created_at")
      .eq("drug_id", row.id)
      .order("created_at", { ascending: false });

    if (error) {
      setHistoryRows([]);
      setHistoryError(normalizeTreatmentModuleError(error.message));
      setHistoryLoading(false);
      return;
    }

    const baseRows = ((data as AuditLogRow[] | null) ?? []).map((item) => ({
      ...item,
      changed_by_label: "Unknown editor",
    }));

    const editorIds = Array.from(new Set(baseRows.map((item) => item.changed_by_user_id).filter(Boolean)));
    if (editorIds.length === 0) {
      setHistoryRows(baseRows);
      setHistoryLoading(false);
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, username, email")
      .in("id", editorIds);

    if (profileError) {
      setHistoryRows(baseRows);
      setHistoryLoading(false);
      return;
    }

    const profileMap = new Map(
      ((profileRows as Array<{ id: string; full_name: string | null; username: string | null; email: string | null }> | null) ?? []).map(
        (item) => [item.id, item],
      ),
    );

    setHistoryRows(
      baseRows.map((item) => ({
        ...item,
        changed_by_label: buildActorLabel(profileMap.get(item.changed_by_user_id) ?? null),
      })),
    );
    setHistoryLoading(false);
  };

  const handleSave = async () => {
    if (!canEditRows) {
      toast.error("Sign in with editor access to make treatment changes.");
      return;
    }

    if (!selectedRow && !canApprove) {
      return;
    }

    const parsed = editSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof EditFormState, string>> = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof EditFormState | undefined;
        if (field) {
          nextErrors[field] = issue.message;
        }
      });
      setFormErrors(nextErrors);
      return;
    }

    setSaving(true);
    const rpcName = !selectedRow
      ? "create_antidepressant_with_audit"
      : canApprove
        ? "update_antidepressant_with_audit"
        : "submit_antidepressant_pending_edit";
    const rpcArgs = !selectedRow
      ? {
          p_category_id: categoryId,
          p_drug_name: parsed.data.drug_name,
          p_medication_type: parsed.data.medication_type,
          p_frequency: parsed.data.frequency.trim() || null,
          p_line_of_treatment: parsed.data.line_of_treatment,
          p_initiation_dose_mg: parsed.data.initiation_dose_mg,
          p_therapeutic_min_dose_mg: parsed.data.therapeutic_min_dose_mg,
          p_therapeutic_max_dose_mg: parsed.data.therapeutic_max_dose_mg,
          p_max_dose_mg: parsed.data.max_dose_mg,
          p_change_reason: parsed.data.change_reason,
        }
      : {
          p_drug_id: selectedRow.id,
          p_drug_name: parsed.data.drug_name,
          p_medication_type: parsed.data.medication_type,
          p_frequency: parsed.data.frequency.trim() || null,
          p_line_of_treatment: parsed.data.line_of_treatment,
          p_initiation_dose_mg: parsed.data.initiation_dose_mg,
          p_therapeutic_min_dose_mg: parsed.data.therapeutic_min_dose_mg,
          p_therapeutic_max_dose_mg: parsed.data.therapeutic_max_dose_mg,
          p_max_dose_mg: parsed.data.max_dose_mg,
          p_change_reason: parsed.data.change_reason,
        };

    const { error } = await supabase.rpc(rpcName, rpcArgs);
    setSaving(false);

    if (error) {
      toast.error(normalizeTreatmentModuleError(error.message));
      return;
    }

    toast.success(!selectedRow ? "Medication added." : canApprove ? "Master entry updated." : "Change proposal submitted for approval.");
    setEditOpen(false);
    setSelectedRow(null);
    setForm(emptyForm);
    setFormErrors({});
    await loadRows();
    await loadPendingRows();
    if (selectedRow && historyTarget?.id === selectedRow.id) {
      await loadHistory(selectedRow);
    }
  };

  const handleReview = async () => {
    if (!canApprove || !reviewTarget) {
      return;
    }

    setReviewSaving(true);
    const rpcName =
      reviewAction === "approve"
        ? "approve_antidepressant_pending_edit"
        : "reject_antidepressant_pending_edit";

    const { error } = await supabase.rpc(rpcName, {
      p_pending_edit_id: reviewTarget.id,
      p_review_note: reviewNote.trim() || null,
    });
    setReviewSaving(false);

    if (error) {
      toast.error(normalizeTreatmentModuleError(error.message));
      return;
    }

    toast.success(reviewAction === "approve" ? "Pending edit approved." : "Pending edit rejected.");
    setReviewOpen(false);
    setReviewTarget(null);
    setReviewNote("");
    await loadRows();
    await loadPendingRows();
    if (historyTarget?.id === reviewTarget.drug_id) {
      const row = masterRowMap.get(reviewTarget.drug_id);
      if (row) {
        await loadHistory(row);
      }
    }
  };

  const renderTreatmentTable = (lineRows: AntidepressantMasterRow[]) => {
    if (lineRows.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
          No medications are configured for this treatment line yet.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Drug</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Initiation Dose</TableHead>
              <TableHead>Therapeutic Range</TableHead>
              <TableHead>Max Dose</TableHead>
              {canViewUpdatedAt && <TableHead>Updated</TableHead>}
              {showActionColumn && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <button
                    type="button"
                    className={`text-left font-medium transition-all duration-200 focus-visible:outline-none ${
                      selectedMedicationId === row.id
                        ? "text-primary [text-shadow:0_0_14px_hsl(var(--primary)/0.35)]"
                        : "text-foreground hover:text-primary hover:[text-shadow:0_0_14px_hsl(var(--primary)/0.35)] focus-visible:text-primary focus-visible:[text-shadow:0_0_14px_hsl(var(--primary)/0.35)]"
                    }`}
                    aria-label={`Select medication ${row.drug_name}`}
                    onClick={() => handleMedicationSelection(row.id, true)}
                  >
                    {row.drug_name}
                  </button>
                </TableCell>
                <TableCell>{formatMedicationType(row.medication_type)}</TableCell>
                <TableCell>{row.frequency || "Not set"}</TableCell>
                <TableCell>{formatDoseCellValue(row.initiation_dose_mg)}</TableCell>
                <TableCell>{formatDoseRangeCellValue(row.therapeutic_min_dose_mg, row.therapeutic_max_dose_mg)}</TableCell>
                <TableCell>{formatDoseCellValue(row.max_dose_mg)}</TableCell>
                {canViewUpdatedAt && (
                  <TableCell className="text-muted-foreground">{formatTimestamp(row.updated_at)}</TableCell>
                )}
                {showActionColumn && (
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canViewHistory && (
                        <Button type="button" variant="outline" size="sm" onClick={() => void loadHistory(row)}>
                          <FileClock className="mr-1.5 h-3.5 w-3.5" />
                          History
                        </Button>
                      )}
                      {canEditRows && (
                        <Button type="button" size="sm" onClick={() => openEditDialog(row)}>
                          <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                          {canApprove ? "Edit" : "Propose change"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loadingRows) {
    return <div className="text-sm text-muted-foreground">Loading treatment module...</div>;
  }

  return (
    <>
      <Card className="border-dashed border-border/80 bg-muted/10 shadow-none">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {categoryName && <Badge variant="secondary">{categoryName}</Badge>}
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Audit tracked
              </Badge>
            </div>
            <CardTitle>Initiation of Treatment</CardTitle>
            <CardDescription>
              Select a line of treatment first, review the medications configured for that line, then choose a starting
              dose and titration schedule for the medication you want to use.
            </CardDescription>
          </div>
          <div className="space-y-3 sm:max-w-sm">
            <div className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {authLoading
                ? "Treatment changes are audit tracked."
                : user
                  ? "Direct changes write to the audit log. Proposed changes stay in a pending queue until a super admin approves or rejects them."
                  : "Viewing is public. Sign in only if you need to add, propose, or approve treatment changes."}
            </div>
            {!authLoading && !user && (
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link to="/login">Log in to make changes</Link>
              </Button>
            )}
            {canApprove && (
              <Button type="button" className="w-full sm:w-auto" onClick={openCreateDialog}>
                Add medication
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="steps" className="space-y-4">
            {canTrackPending && (
              <TabsList className="w-full justify-start sm:w-auto">
                <TabsTrigger value="steps">Treatment Steps</TabsTrigger>
                <TabsTrigger value="workflow">{canApprove ? "Pending Approvals" : "My Proposals"}</TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="steps" className="space-y-4">
              {rowsError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {rowsError}
                </div>
              )}

              {!rowsError && rows.length === 0 && (
                <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                  {canApprove
                    ? "No medications are configured for this category yet. Use Add medication to create the first row."
                    : "No medications are configured for this category yet."}
                </div>
              )}

              {!rowsError && rows.length > 0 && (
                <>
                  <Card className="border-dashed border-border/80 bg-muted/15 shadow-none">
                    <CardContent className="space-y-4 p-4 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h2 className="font-display text-2xl font-semibold text-foreground">
                              Factors to consider
                            </h2>
                            {canEditContent &&
                              (isEditingFactors ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={onCancelEditingFactors}
                                    disabled={isSavingFactors}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={onSaveFactors}
                                    disabled={isSavingFactors}
                                  >
                                    {isSavingFactors ? "Saving..." : "Save"}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Edit factors to consider"
                                  onClick={onStartEditingFactors}
                                >
                                  <PencilLine className="h-4 w-4" />
                                </Button>
                              ))}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Review these category-level considerations before selecting a treatment line and starting dose.
                          </p>
                        </div>
                      </div>

                      {isEditingFactors ? (
                        <RichTextEditor
                          value={factorsContent}
                          onChange={(value) => onFactorsContentChange?.(value)}
                          placeholder="Add factors to consider notes..."
                        />
                      ) : factorsContentHasValue ? (
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <div
                            className="rich-text-content text-[15px] leading-relaxed text-muted-foreground sm:text-base"
                            dangerouslySetInnerHTML={{ __html: factorsContent }}
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                          No factors to consider notes yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-dashed border-border/80 bg-muted/15 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg">Select line of treatment</CardTitle>
                      <CardDescription>
                        {rows.length} medication{rows.length === 1 ? "" : "s"} are configured for this category across{" "}
                        {TREATMENT_LINES.filter((line) => groupedRows[line].length > 0).length} populated treatment
                        line{TREATMENT_LINES.filter((line) => groupedRows[line].length > 0).length === 1 ? "" : "s"}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Label>Line of treatment</Label>
                      <div className="grid gap-4 md:grid-cols-[minmax(0,420px)_1fr] md:items-center">
                        <div className="grid grid-cols-3 gap-2">
                          {TREATMENT_LINES.map((line) => {
                            const isSelected = selectedLine === String(line);

                            return (
                              <Button
                                key={line}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                className="w-full"
                                aria-pressed={isSelected}
                                onClick={() => handleLineChange(String(line))}
                              >
                                Line {line}
                              </Button>
                            );
                          })}
                        </div>

                        <div className="flex min-h-14 items-center rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                          {selectedLine
                            ? `Showing Line ${selectedLine}. ${selectedLineRows.length} medication${selectedLineRows.length === 1 ? "" : "s"} are available in this treatment line.`
                            : "Select a treatment line first to review the medications, doses, and starting schedule guidance for that line."}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedLine ? (
                    <Card className="border-dashed border-border/80 bg-muted/15 shadow-none">
                      <CardContent className="space-y-8 p-4 sm:p-6">
                        <section className="space-y-4">
                          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <h3 className="font-display text-lg font-semibold text-foreground">
                                  Line {selectedLine} Treatment
                                </h3>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-expanded={!isLineTableCollapsed}
                                  aria-label={isLineTableCollapsed ? "Expand medication table" : "Collapse medication table"}
                                  onClick={() => setIsLineTableCollapsed((prev) => !prev)}
                                >
                                  {isLineTableCollapsed ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronUp className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {selectedLineRows.length} medication{selectedLineRows.length === 1 ? "" : "s"}
                              </span>
                            </div>

                            {!isLineTableCollapsed ? (
                              <div className="mt-4">{renderTreatmentTable(selectedLineRows)}</div>
                            ) : (
                              <div className="mt-4 rounded-xl border border-dashed border-border/80 px-4 py-3 text-sm text-muted-foreground">
                                The medication table is collapsed. Expand it to review all medications in Line {selectedLine}.
                              </div>
                            )}
                          </div>
                        </section>

                        <div className="border-t border-border/70" />

                        <section ref={medicationSelectionSectionRef} className="space-y-4">
                          <div className="space-y-1">
                            <h2 className="font-display text-2xl font-semibold text-foreground">
                              Pick a starting dose and titration schedule
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              Select a medication from Line {selectedLine}. The details below reflect the information stored
                              for that medication in Initiation of Treatment.
                            </p>
                          </div>

                          <div className="space-y-2 md:max-w-md">
                            <Label>Medication</Label>
                            <Select value={selectedMedicationId} onValueChange={(value) => handleMedicationSelection(value)}>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    selectedLineRows.length > 0
                                      ? "Select a medication"
                                      : "No medications available in this line"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedLineRows.map((row) => (
                                  <SelectItem key={row.id} value={row.id}>
                                    {row.drug_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedMedication ? (
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <Badge variant="outline">Line {selectedMedication.line_of_treatment}</Badge>
                                    <Badge variant="outline">{formatMedicationType(selectedMedication.medication_type)}</Badge>
                                    {selectedMedication.frequency && (
                                      <Badge variant="outline">{selectedMedication.frequency}</Badge>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-display text-lg font-semibold text-foreground">
                                      {selectedMedication.drug_name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Use the information below to choose the starting dose and titration schedule for this
                                      medication.
                                    </p>
                                  </div>
                                </div>

                                {showActionColumn && (
                                  <div className="flex flex-wrap gap-2">
                                    {canViewHistory && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void loadHistory(selectedMedication)}
                                      >
                                        <FileClock className="mr-1.5 h-3.5 w-3.5" />
                                        History
                                      </Button>
                                    )}
                                    {canEditRows && (
                                      <Button type="button" size="sm" onClick={() => openEditDialog(selectedMedication)}>
                                        <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                                        {canApprove ? "Edit" : "Propose change"}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drug name</p>
                                  <p className="mt-2 text-sm text-foreground">{selectedMedication.drug_name}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medication type</p>
                                  <p className="mt-2 text-sm text-foreground">
                                    {formatMedicationType(selectedMedication.medication_type)}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frequency</p>
                                  <p className="mt-2 text-sm text-foreground">{selectedMedication.frequency || "Not set"}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Initiation dose</p>
                                  <p className="mt-2 text-sm text-foreground">
                                    {formatDoseCellValue(selectedMedication.initiation_dose_mg)}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Therapeutic range</p>
                                  <p className="mt-2 text-sm text-foreground">
                                    {formatDoseRangeCellValue(
                                      selectedMedication.therapeutic_min_dose_mg,
                                      selectedMedication.therapeutic_max_dose_mg,
                                    )}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Maximum dose</p>
                                  <p className="mt-2 text-sm text-foreground">
                                    {formatDoseCellValue(selectedMedication.max_dose_mg)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                              {selectedLineRows.length > 0
                                ? `Choose a medication from Line ${selectedLine} to review its starting dose and titration information.`
                                : "No medications are configured in this line yet."}
                            </div>
                          )}
                        </section>

                        <div className="border-t border-border/70" />

                        <section className="space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h2 className="font-display text-2xl font-semibold text-foreground">
                                  Patient education
                                </h2>
                                {canEditContent &&
                                  (isEditingPatientEducation ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={onCancelEditingPatientEducation}
                                        disabled={isSavingPatientEducation}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={onSavePatientEducation}
                                        disabled={isSavingPatientEducation}
                                      >
                                        {isSavingPatientEducation ? "Saving..." : "Save"}
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      aria-label="Edit patient education"
                                      onClick={onStartEditingPatientEducation}
                                    >
                                      <PencilLine className="h-4 w-4" />
                                    </Button>
                                  ))}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Add practical counseling, expectations, and monitoring notes for the patient.
                              </p>
                            </div>
                          </div>

                          {isEditingPatientEducation ? (
                            <RichTextEditor
                              value={patientEducationContent}
                              onChange={(value) => onPatientEducationContentChange?.(value)}
                              placeholder="Add patient education notes..."
                            />
                          ) : patientEducationContentHasValue ? (
                            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                              <div
                                className="rich-text-content text-[15px] leading-relaxed text-muted-foreground sm:text-base"
                                dangerouslySetInnerHTML={{ __html: patientEducationContent }}
                              />
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                              No patient education notes yet.
                            </div>
                          )}
                        </section>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                      Select Line 1, 2, or 3 to open the treatment workflow for this category.
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {canTrackPending && (
              <TabsContent value="workflow" className="space-y-4">
              {pendingError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {pendingError}
                </div>
              )}

              {loadingPending ? (
                <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                  Loading workflow queue...
                </div>
              ) : pendingRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                  {canApprove ? "No pending proposals right now." : "You have not submitted any proposals yet."}
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRows.map((item) => {
                    const currentRow = masterRowMap.get(item.drug_id);
                    const currentSnapshot = currentRow ? toSnapshot(currentRow) : null;
                    const changedFields = AUDITED_FIELDS.filter(({ key }) => item.previous_data?.[key] !== item.proposed_data?.[key]);
                    const isStale =
                      item.status === "pending" && currentSnapshot ? !snapshotsMatch(item.previous_data, currentSnapshot) : false;

                    return (
                      <div key={item.id} className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-foreground">{item.proposed_data.drug_name}</p>
                              <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
                              {isStale && <Badge variant="destructive">stale</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Proposed by {item.proposed_by_label} on {formatTimestamp(item.created_at)}
                            </p>
                            {item.reviewed_at && item.reviewed_by_label && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Reviewed by {item.reviewed_by_label} on {formatTimestamp(item.reviewed_at)}
                              </p>
                            )}
                          </div>

                          {canApprove && item.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isStale}
                                onClick={() => openReviewDialog(item, "approve")}
                              >
                                Approve
                              </Button>
                              <Button type="button" variant="destructive" size="sm" onClick={() => openReviewDialog(item, "reject")}>
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 rounded-xl bg-background/70 p-3 text-sm text-foreground">
                          <span className="font-medium">Change reason:</span> {item.change_reason}
                        </div>

                        {item.review_note && (
                          <div className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3 text-sm text-foreground">
                            <span className="font-medium">Review note:</span> {item.review_note}
                          </div>
                        )}

                        {isStale && (
                          <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            The master row changed after this proposal was submitted. This proposal should be reviewed and
                            resubmitted against the latest data.
                          </div>
                        )}

                        <div className="mt-3 space-y-3">
                          {changedFields.map(({ key, label }) => (
                            <div key={key} className="grid gap-3 rounded-xl border border-border/70 bg-background/70 p-3 sm:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current at submission</p>
                                <p className="mt-1 text-sm text-foreground">{formatSnapshotValue(item.previous_data, key)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed {label}</p>
                                <p className="mt-1 text-sm text-foreground">{formatSnapshotValue(item.proposed_data, key)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {!selectedRow
                ? "Add medication"
                : canApprove
                  ? "Edit initiation of treatment entry"
                  : "Propose medication change"}
            </DialogTitle>
            <DialogDescription>
              {!selectedRow
                ? "This creates a new medication row for the current category and writes an audit log entry."
                : canApprove
                ? "This updates the master record immediately and writes an audit log entry."
                : "This submits a pending change for super-admin approval. The master record stays unchanged until approved."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="drug_name">Drug name</Label>
              <Input
                id="drug_name"
                value={form.drug_name}
                onChange={(event) => setForm((prev) => ({ ...prev, drug_name: event.target.value }))}
              />
              {formErrors.drug_name && <p className="text-sm text-destructive">{formErrors.drug_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="medication_type">Type</Label>
              <Input
                id="medication_type"
                value={form.medication_type}
                onChange={(event) => setForm((prev) => ({ ...prev, medication_type: event.target.value }))}
                placeholder="Example: monotherapy"
              />
              {formErrors.medication_type && <p className="text-sm text-destructive">{formErrors.medication_type}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Input
                id="frequency"
                value={form.frequency}
                onChange={(event) => setForm((prev) => ({ ...prev, frequency: event.target.value }))}
                placeholder="Example: daily, nightly, BID"
              />
              {formErrors.frequency && <p className="text-sm text-destructive">{formErrors.frequency}</p>}
            </div>

            <div className="space-y-2">
              <Label>Line of treatment</Label>
              <Select
                value={form.line_of_treatment}
                onValueChange={(value) => setForm((prev) => ({ ...prev, line_of_treatment: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Line 1</SelectItem>
                  <SelectItem value="2">Line 2</SelectItem>
                  <SelectItem value="3">Line 3</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.line_of_treatment && <p className="text-sm text-destructive">{formErrors.line_of_treatment}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="initiation_dose_mg">Initiation dose (mg)</Label>
              <Input
                id="initiation_dose_mg"
                type="number"
                min="0"
                step="1"
                value={form.initiation_dose_mg}
                onChange={(event) => setForm((prev) => ({ ...prev, initiation_dose_mg: event.target.value }))}
              />
              {formErrors.initiation_dose_mg && <p className="text-sm text-destructive">{formErrors.initiation_dose_mg}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="therapeutic_min_dose_mg">Therapeutic minimum (mg)</Label>
              <Input
                id="therapeutic_min_dose_mg"
                type="number"
                min="0"
                step="1"
                value={form.therapeutic_min_dose_mg}
                onChange={(event) => setForm((prev) => ({ ...prev, therapeutic_min_dose_mg: event.target.value }))}
              />
              {formErrors.therapeutic_min_dose_mg && <p className="text-sm text-destructive">{formErrors.therapeutic_min_dose_mg}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="therapeutic_max_dose_mg">Therapeutic maximum (mg)</Label>
              <Input
                id="therapeutic_max_dose_mg"
                type="number"
                min="0"
                step="1"
                value={form.therapeutic_max_dose_mg}
                onChange={(event) => setForm((prev) => ({ ...prev, therapeutic_max_dose_mg: event.target.value }))}
              />
              {formErrors.therapeutic_max_dose_mg && <p className="text-sm text-destructive">{formErrors.therapeutic_max_dose_mg}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_dose_mg">Maximum dose (mg)</Label>
              <Input
                id="max_dose_mg"
                type="number"
                min="0"
                step="1"
                value={form.max_dose_mg}
                onChange={(event) => setForm((prev) => ({ ...prev, max_dose_mg: event.target.value }))}
              />
              {formErrors.max_dose_mg && <p className="text-sm text-destructive">{formErrors.max_dose_mg}</p>}
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">
                Leave all four dose fields blank if numeric initiation and therapeutic guidance are not available yet.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="change_reason">Change reason</Label>
              <Textarea
                id="change_reason"
                rows={4}
                value={form.change_reason}
                onChange={(event) => setForm((prev) => ({ ...prev, change_reason: event.target.value }))}
                placeholder="Example: Therapeutic ceiling adjusted after approved 2026 medication review."
              />
              {formErrors.change_reason && <p className="text-sm text-destructive">{formErrors.change_reason}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving..." : canApprove ? "Save with audit trail" : "Submit for approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldQuestion className="h-5 w-5" />
              {reviewAction === "approve" ? "Approve pending change" : "Reject pending change"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "Approving pushes the proposed numeric dose data into the master table and writes the audit log."
                : "Rejecting leaves the master table unchanged and records the review outcome."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-foreground">
              <span className="font-medium">Proposal reason:</span> {reviewTarget?.change_reason}
            </div>

            <div className="space-y-2">
              <Label htmlFor="review_note">Review note</Label>
              <Textarea
                id="review_note"
                rows={4}
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Optional reviewer note for the approval decision."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setReviewOpen(false)} disabled={reviewSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={reviewAction === "approve" ? "default" : "destructive"}
              onClick={() => void handleReview()}
              disabled={reviewSaving}
            >
              {reviewSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {reviewSaving
                ? "Saving..."
                : reviewAction === "approve"
                  ? "Approve and apply"
                  : "Reject proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Audit history
            </DialogTitle>
            <DialogDescription>
              {historyTarget ? `Change narrative for ${historyTarget.drug_name}.` : "Per-change history for this medication."}
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading history...</div>
          ) : historyError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {historyError}
            </div>
          ) : historyRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
              No audit entries exist for this medication yet.
            </div>
          ) : (
            <div className="space-y-4">
              {historyRows.map((item) => {
                const changedFields = AUDITED_FIELDS.filter(
                  ({ key }) => item.previous_data?.[key] !== item.new_data?.[key],
                );

                return (
                  <div key={item.id} className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.changed_by_label}</p>
                        <p className="text-xs text-muted-foreground">{formatTimestamp(item.created_at)}</p>
                      </div>
                      <Badge variant="outline">{changedFields.length} field(s) changed</Badge>
                    </div>

                    <div className="mt-3 rounded-xl bg-background/70 p-3 text-sm text-foreground">
                      <span className="font-medium">Reason:</span> {item.change_reason}
                    </div>

                    <div className="mt-3 space-y-3">
                      {changedFields.map(({ key, label }) => (
                        <div key={key} className="grid gap-3 rounded-xl border border-border/70 bg-background/70 p-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Previous {label}</p>
                            <p className="mt-1 text-sm text-foreground">{formatSnapshotValue(item.previous_data, key)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New {label}</p>
                            <p className="mt-1 text-sm text-foreground">{formatSnapshotValue(item.new_data, key)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InitiationOfTreatment;
