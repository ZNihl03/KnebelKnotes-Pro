import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useUiPreferences } from "@/contexts/UiPreferencesContext";
import { Button } from "@/components/ui/button";

type Category = {
  id: string;
  short_code: string;
  name: string;
  description: string | null;
};

const Categories = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { showCategoryIds } = useUiPreferences();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFeatureBanner, setShowFeatureBanner] = useState(true);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, short_code, name, description")
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setCategories(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!isMounted) return;
      await loadCategories();
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [loadCategories]);

  return (
    <Layout>
      {showFeatureBanner && (
        <div className="border-b border-emerald-300/60 bg-gradient-to-r from-emerald-100 via-green-100 to-lime-100 dark:border-emerald-600/70 dark:from-emerald-800/95 dark:via-green-700/90 dark:to-lime-800/95">
          <div className="container flex items-center justify-between gap-4 py-3">
            <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
              New Feature: Clinical Dosage Support for Depression
            </p>
            <button
              type="button"
              onClick={() => setShowFeatureBanner(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-emerald-800 transition-colors hover:bg-white/60 hover:text-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-50"
              aria-label="Dismiss new feature message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="container py-10 sm:py-12">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">All Categories</h1>
            <p className="mt-2 text-muted-foreground">Browse categories for now.</p>
          </div>
          {!authLoading && user && (profile?.role === "super_admin" || profile?.role === "sub_admin") && (
            <Button asChild className="w-full md:w-auto">
              <Link to="/categories/new">Create category</Link>
            </Button>
          )}
        </div>

        {loading && <div className="text-sm text-muted-foreground">Loading categories...</div>}

        {error && (
          <div className="rounded-2xl border border-border/70 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && categories.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/70 p-6 text-sm text-muted-foreground sm:p-8">
            {authLoading
              ? "No categories yet."
              : user
                ? "No categories yet. Admins can add the first one."
                : "No categories yet. Sign in to create the first one."}
          </div>
        )}

        {!loading && !error && categories.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/category/${category.id}`}
                className="group rounded-2xl border border-border/70 bg-card/85 p-4 shadow-[var(--card-shadow)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--card-shadow-hover)] sm:p-5"
              >
                {showCategoryIds && (
                  <span className="mb-3 inline-flex rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {category.short_code}
                  </span>
                )}
                <h3 className="font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {category.description || "No description provided yet."}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Categories;
