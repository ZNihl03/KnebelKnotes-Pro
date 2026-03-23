import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Search, Clock, Tag, Folder, Pill } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { searchArticles, type Article } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import {
  formatTreatmentLines,
  searchTreatmentMedications,
  type MedicationSearchResult,
} from "@/lib/treatmentSearch";
import { useUiPreferences } from "@/contexts/UiPreferencesContext";

type CategoryResult = {
  id: string;
  short_code: string;
  name: string;
  description: string | null;
};

const SearchPage = () => {
  const { showCategoryIds } = useUiPreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const paramQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(paramQuery);
  const [categoryResults, setCategoryResults] = useState<CategoryResult[]>([]);
  const [medicationResults, setMedicationResults] = useState<MedicationSearchResult[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [medicationError, setMedicationError] = useState<string | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [medicationLoading, setMedicationLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);

  const effectiveQuery = query.trim();

  useEffect(() => {
    setQuery(paramQuery);
  }, [paramQuery]);

  const results = useMemo(() => (effectiveQuery ? searchArticles(effectiveQuery) : []), [effectiveQuery]);
  const totalResults = medicationResults.length + categoryResults.length + results.length;
  const suggestions = useMemo(() => {
    if (!effectiveQuery) return [];
    const medicationSuggestions = medicationResults.map((result) => ({
      type: "medication" as const,
      label: result.drug_name,
      id: `${result.category_id}-${result.drug_name}`,
      detail: `${result.category_name} • ${formatTreatmentLines(result.line_numbers)}`,
      meta: showCategoryIds ? result.category_short_code : null,
      route: `/category/${result.category_id}#treatment`,
    }));
    const categorySuggestions = categoryResults.map((category) => ({
      type: "category" as const,
      label: category.name,
      id: category.id,
      detail: null,
      meta: showCategoryIds ? category.short_code : null,
      route: null,
    }));
    const articleSuggestions = (results as Article[]).map((article) => ({
      type: "article" as const,
      label: article.title,
      id: article.id,
      detail: null,
      meta: null,
      route: null,
    }));
    return [...medicationSuggestions, ...categorySuggestions, ...articleSuggestions].slice(0, 8);
  }, [effectiveQuery, medicationResults, categoryResults, results, showCategoryIds]);

  useEffect(() => {
    let isMounted = true;
    const searchTerm = effectiveQuery;

    const fetchCategories = async () => {
      if (!searchTerm) {
        setCategoryResults([]);
        setMedicationResults([]);
        setCategoryError(null);
        setMedicationError(null);
        setCategoryLoading(false);
        setMedicationLoading(false);
        return;
      }

      setCategoryLoading(true);
      setMedicationLoading(true);
      const [{ data, error }, medicationSearch] = await Promise.all([
        supabase
          .from("categories")
          .select("id, short_code, name, description")
          .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,short_code.ilike.%${searchTerm}%`)
          .order("name", { ascending: true })
          .limit(10),
        searchTreatmentMedications(searchTerm),
      ]);

      if (!isMounted) return;
      if (error) {
        setCategoryError(error.message);
        setCategoryResults([]);
      } else {
        setCategoryResults(data ?? []);
        setCategoryError(null);
      }

      setCategoryLoading(false);
      setMedicationResults(medicationSearch.data);
      setMedicationError(medicationSearch.error);
      setMedicationLoading(false);
    };

    const debounce = window.setTimeout(() => {
      void fetchCategories();
    }, 200);

    return () => {
      isMounted = false;
      window.clearTimeout(debounce);
    };
  }, [effectiveQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    }
    setShowSuggestions(false);
  };

  const handleSuggestionSelect = (item: (typeof suggestions)[number]) => {
    setQuery(item.label);
    if (item.route) {
      setShowSuggestions(false);
      navigate(item.route);
      return;
    }
    setSearchParams({ q: item.label });
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  return (
    <Layout>
      <div className="container max-w-3xl py-10 sm:py-12">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6 sm:text-3xl">Search</h1>

        <form onSubmit={handleSearch} className="mb-8 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex flex-1 items-center gap-2 rounded-xl border border-input bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search disorders, medications, criteria..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="flex-1 bg-transparent py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {showSuggestions && effectiveQuery && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-border bg-card p-2 shadow-lg"
                onMouseDown={(event) => event.preventDefault()}
              >
                <div className="space-y-1">
                  {suggestions.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => handleSuggestionSelect(item)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent-foreground">
                        {item.type === "medication" ? (
                          <Pill className="h-3.5 w-3.5" />
                        ) : item.type === "category" ? (
                          <Folder className="h-3.5 w-3.5" />
                        ) : (
                          <Search className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.label}</span>
                        {item.detail && (
                          <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                        )}
                      </span>
                      {item.meta && (
                        <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          {item.meta}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full sm:w-auto">Search</Button>
        </form>

        {effectiveQuery && (
          <p className="mb-6 text-sm text-muted-foreground">
            {totalResults} result{totalResults !== 1 ? "s" : ""} for "
            <span className="font-medium text-foreground">{effectiveQuery}</span>"
          </p>
        )}

        {medicationError && (
          <div className="mb-6 rounded-2xl border border-border/70 bg-destructive/10 p-4 text-sm text-destructive">
            {medicationError}
          </div>
        )}

        {categoryError && (
          <div className="mb-6 rounded-2xl border border-border/70 bg-destructive/10 p-4 text-sm text-destructive">
            {categoryError}
          </div>
        )}

        {medicationResults.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">Medications</h2>
            <div className="space-y-3">
              {medicationResults.map((result) => (
                <Link
                  key={`${result.category_id}-${result.drug_name}`}
                  to={`/category/${result.category_id}#treatment`}
                  className="group block rounded-2xl border border-border/70 bg-card/90 p-4 shadow-[var(--card-shadow)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--card-shadow-hover)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent-foreground">
                      <Pill className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {result.drug_name}
                        </p>
                        {showCategoryIds && (
                          <span className="inline-flex rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            {result.category_short_code}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Used in <span className="font-medium text-foreground">{result.category_name}</span> under{" "}
                        {formatTreatmentLines(result.line_numbers)} in Initiation of Treatment.
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {categoryResults.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">Categories</h2>
            <div className="space-y-3">
              {categoryResults.map((category) => (
                <Link
                  key={category.id}
                  to={`/category/${category.id}`}
                  className="group block rounded-2xl border border-border/70 bg-card/90 p-4 shadow-[var(--card-shadow)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--card-shadow-hover)]"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent-foreground">
                      <Folder className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      {showCategoryIds && (
                        <p className="mb-1 inline-flex rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          {category.short_code}
                        </p>
                      )}
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {category.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {category.description || "No description provided yet."}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">Articles</h2>
        )}
        <div className="space-y-3">
          {results.map((article, i) => (
            <Link
              key={article.id}
              to={`/article/${article.slug}`}
              className="group block rounded-2xl border border-border/70 bg-card/90 p-4 transition-all hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-0.5 animate-fade-in sm:p-5"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <h3 className="font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                {article.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                {article.excerpt}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {article.updatedAt}
                </span>
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {article.tags.slice(0, 3).join(", ")}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {effectiveQuery && !categoryLoading && !medicationLoading && medicationResults.length === 0 && categoryResults.length === 0 && results.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-center sm:p-10">
            <p className="text-muted-foreground">No results found. Try a different search term.</p>
          </div>
        )}

        {!effectiveQuery && (
          <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-center sm:p-10">
            <Search className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Enter a search term to find medications, categories, or articles.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SearchPage;
