import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight,
  ClipboardList,
  Bandage,
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

type CategoryDetailRecord = {
  id: string;
  short_code: string;
  name: string;
  description: string | null;
  diagnosis: string | null;
  treatment: string | null;
  improvement: string | null;
  reassessment: string | null;
  trial: string | null;
};

const ALL_SECTION_KEYS = ["diagnosis", "treatment", "improvement", "reassessment", "trial"] as const;

const VISIBLE_SECTIONS = [
  { key: "diagnosis", label: "Diagnosis", icon: ClipboardList },
  { key: "treatment", label: "Initiation of Treatment", icon: Bandage },
  { key: "reassessment", label: "Assessment of Response", icon: RefreshCcw },
] as const;

type SectionFieldKey = (typeof ALL_SECTION_KEYS)[number];
type SectionKey = (typeof VISIBLE_SECTIONS)[number]["key"];
type SectionDraft = Record<SectionFieldKey, string>;

const createSectionDraft = (
  source?: Partial<Record<SectionFieldKey, string | null | undefined>>,
): SectionDraft => ({
  diagnosis: sanitizeRichText(source?.diagnosis),
  treatment: sanitizeRichText(source?.treatment),
  improvement: sanitizeRichText(source?.improvement),
  reassessment: sanitizeRichText(source?.reassessment),
  trial: sanitizeRichText(source?.trial),
});

const CategoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [category, setCategory] = useState<CategoryDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SectionKey>("diagnosis");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteTimerRef = useRef<number | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [draft, setDraft] = useState<SectionDraft>(createSectionDraft());

  useEffect(() => {
    let isMounted = true;

    const loadCategory = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("categories")
        .select("id, short_code, name, description, diagnosis, treatment, improvement, reassessment, trial")
        .eq("id", id)
        .maybeSingle();

      if (!isMounted) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setCategory(null);
        setLoading(false);
        return;
      }

      setCategory(data);
      setDraft(createSectionDraft(data));
      setMetaName(data.name ?? "");
      setMetaDescription(data.description ?? "");
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
  };

  const activeSection = useMemo(
    () => VISIBLE_SECTIONS.find((section) => section.key === activeTab) ?? VISIBLE_SECTIONS[0],
    [activeTab],
  );
  const activeContent = useMemo(() => sanitizeRichText(draft[activeTab]), [activeTab, draft]);
  const activeContentHasValue = useMemo(() => richTextHasContent(activeContent), [activeContent]);

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
      improvement: toStoredRichText(nextDraft.improvement),
      reassessment: toStoredRichText(nextDraft.reassessment),
      trial: toStoredRichText(nextDraft.trial),
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

  const cancelDelete = () => {
    if (deleteTimerRef.current) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPendingDelete(false);
    toast.message("Deletion canceled.");
  };

  const scheduleDelete = () => {
    if (!category || pendingDelete) return;
    setDeleteDialogOpen(false);
    setPendingDelete(true);
    toast("Category will be deleted in 5 seconds.", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: cancelDelete,
      },
    });
    deleteTimerRef.current = window.setTimeout(() => {
      setPendingDelete(false);
      void executeDelete();
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        window.clearTimeout(deleteTimerRef.current);
      }
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
              {category.name} ({category.short_code})
            </span>
          </nav>

          <div className="mb-4 space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-[var(--card-shadow)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {category.short_code}
                </div>
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
          ]}
          activeLink={`#${activeTab}`}
          onNavigate={(link) => handleJump(link.replace("#", "") as SectionKey)}
        />

        <div className="container mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          {canEdit && (
            <>
              {editing ? (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={handleCancel} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" onClick={() => setEditing(true)} className="w-full gap-2 sm:w-auto">
                  <PenLine className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="container mt-6">
            <div className="rounded-2xl border border-border/70 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        <div className="container py-5">
          <section className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-[var(--card-shadow)] sm:p-6">
            <h2 className="font-display text-xl font-semibold text-foreground">{activeSection.label}</h2>
            <div className="mt-3">
              {activeTab === "treatment" ? (
                <div className="space-y-6">
                  <div>
                    {editing ? (
                      <RichTextEditor
                        key={activeTab}
                        value={draft[activeTab]}
                        onChange={(value) => setDraft((prev) => ({ ...prev, [activeTab]: value }))}
                        placeholder={`Add ${activeSection.label.toLowerCase()} notes...`}
                      />
                    ) : activeContentHasValue ? (
                      <div
                        className="rich-text-content text-[15px] leading-relaxed text-muted-foreground sm:text-base"
                        dangerouslySetInnerHTML={{ __html: activeContent }}
                      />
                    ) : (
                      <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                        No initiation notes yet.
                      </p>
                    )}
                  </div>

                  <InitiationOfTreatment categoryId={category.id} categoryName={category.name} />
                </div>
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
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default CategoryDetail;
