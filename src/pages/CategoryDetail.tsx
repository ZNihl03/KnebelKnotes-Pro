import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight,
  ClipboardList,
  Bandage,
  TrendingUp,
  RefreshCcw,
  FlaskConical,
  PenLine,
  Trash2,
} from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { FloatingNav } from "@/components/ui/floating-navbar";

type CategoryDetailRecord = {
  id: string;
  name: string;
  description: string | null;
  diagnosis: string | null;
  treatment: string | null;
  improvement: string | null;
  reassessment: string | null;
  trial: string | null;
};

const SECTIONS = [
  { key: "diagnosis", label: "Diagnosis" },
  { key: "treatment", label: "Treatment" },
  { key: "improvement", label: "Improvement" },
  { key: "reassessment", label: "Reassessment" },
  { key: "trial", label: "Trial" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

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
  const [draft, setDraft] = useState<Record<SectionKey, string>>({
    diagnosis: "",
    treatment: "",
    improvement: "",
    reassessment: "",
    trial: "",
  });

  useEffect(() => {
    let isMounted = true;

    const loadCategory = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, description, diagnosis, treatment, improvement, reassessment, trial")
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
      setDraft({
        diagnosis: data.diagnosis ?? "",
        treatment: data.treatment ?? "",
        improvement: data.improvement ?? "",
        reassessment: data.reassessment ?? "",
        trial: data.trial ?? "",
      });
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

  const handleCancel = () => {
    if (!category) return;
    setDraft({
      diagnosis: category.diagnosis ?? "",
      treatment: category.treatment ?? "",
      improvement: category.improvement ?? "",
      reassessment: category.reassessment ?? "",
      trial: category.trial ?? "",
    });
    setEditing(false);
  };

  const handleSave = async () => {
    if (!category) return;
    setSaving(true);
    const { error } = await supabase
      .from("categories")
      .update({
        diagnosis: draft.diagnosis.trim() || null,
        treatment: draft.treatment.trim() || null,
        improvement: draft.improvement.trim() || null,
        reassessment: draft.reassessment.trim() || null,
        trial: draft.trial.trim() || null,
      })
      .eq("id", category.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Category updated.");
    setCategory({
      ...category,
      diagnosis: draft.diagnosis.trim() || null,
      treatment: draft.treatment.trim() || null,
      improvement: draft.improvement.trim() || null,
      reassessment: draft.reassessment.trim() || null,
      trial: draft.trial.trim() || null,
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
      <div className="pb-10">
        <div className="container py-8">
          <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/categories" className="hover:text-foreground transition-colors">
              Categories
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{category.name}</span>
          </nav>

          <div className="mb-4 space-y-3 rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                {editingMeta ? (
                  <input
                    value={metaName}
                    onChange={(event) => setMetaName(event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-auto sm:min-w-[280px]"
                    placeholder="Category name"
                  />
                ) : (
                  <h1 className="font-display text-3xl font-bold text-foreground">{category.name}</h1>
                )}

                {editingMeta ? (
                  <Textarea
                    value={metaDescription}
                    onChange={(event) => setMetaDescription(event.target.value)}
                    placeholder="Category description (optional)"
                    rows={3}
                    className="max-w-2xl"
                  />
                ) : (
                  <p className="text-muted-foreground">
                    {category.description || "No description provided yet."}
                  </p>
                )}
              </div>

              {canEdit && !editingMeta && (
                <button
                  type="button"
                  onClick={() => setEditingMeta(true)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-destructive/40 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
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
                <Button type="button" variant="secondary" size="sm" onClick={handleMetaCancel}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleMetaSave} disabled={savingMeta}>
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
          className="top-20"
          navItems={[
            {
              name: "Diagnosis",
              link: "#diagnosis",
              icon: <ClipboardList className="h-4 w-4" />,
            },
            {
              name: "Treatment",
              link: "#treatment",
              icon: <Bandage className="h-4 w-4" />,
            },
            {
              name: "Improvement",
              link: "#improvement",
              icon: <TrendingUp className="h-4 w-4" />,
            },
            {
              name: "Reassessment",
              link: "#reassessment",
              icon: <RefreshCcw className="h-4 w-4" />,
            },
            {
              name: "Trial",
              link: "#trial",
              icon: <FlaskConical className="h-4 w-4" />,
            },
          ]}
          activeLink={`#${activeTab}`}
          onNavigate={(link) => handleJump(link.replace("#", "") as SectionKey)}
        />

        <div className="container mt-3 flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <>
              {editing ? (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" onClick={() => setEditing(true)} className="gap-2">
                  <PenLine className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="container mt-6">
            <div className="rounded-xl border border-border bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        <div className="container py-5">
          <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-[var(--card-shadow)]">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {SECTIONS.find((section) => section.key === activeTab)?.label}
            </h2>
            <div className="mt-3">
              {editing ? (
                <Textarea
                  value={draft[activeTab]}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [activeTab]: event.target.value }))}
                  placeholder={`Add ${activeTab} notes...`}
                  rows={8}
                />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {draft[activeTab] || "No information yet."}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default CategoryDetail;
