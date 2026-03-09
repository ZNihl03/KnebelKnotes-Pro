import { useSearchParams, Link } from "react-router-dom";
import { Search, Clock, Tag, Folder } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { searchArticles, type Article } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

type CategoryResult = {
  id: string;
  short_code: string;
  name: string;
  description: string | null;
};

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(paramQuery);
  const [categoryResults, setCategoryResults] = useState<CategoryResult[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);

  const effectiveQuery = query.trim();

  useEffect(() => {
    setQuery(paramQuery);
  }, [paramQuery]);

  const results = useMemo(() => (effectiveQuery ? searchArticles(effectiveQuery) : []), [effectiveQuery]);
  const suggestions = useMemo(() => {
    if (!effectiveQuery) return [];
    const categorySuggestions = categoryResults.map((category) => ({
      type: "category" as const,
      label: category.name,
      id: category.id,
      meta: category.short_code,
    }));
    const articleSuggestions = (results as Article[]).map((article) => ({
      type: "article" as const,
      label: article.title,
      id: article.id,
      meta: null,
    }));
    return [...categorySuggestions, ...articleSuggestions].slice(0, 6);
  }, [effectiveQuery, categoryResults, results]);

  useEffect(() => {
    let isMounted = true;
    const searchTerm = effectiveQuery;

    const fetchCategories = async () => {
      if (!searchTerm) {
        setCategoryResults([]);
        setCategoryError(null);
        setCategoryLoading(false);
        return;
      }

      setCategoryLoading(true);
      const { data, error } = await supabase
        .from("categories")
        .select("id, short_code, name, description")
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,short_code.ilike.%${searchTerm}%`)
        .order("name", { ascending: true })
        .limit(10);

      if (!isMounted) return;
      if (error) {
        setCategoryError(error.message);
        setCategoryResults([]);
        setCategoryLoading(false);
        return;
      }

      setCategoryResults(data ?? []);
      setCategoryError(null);
      setCategoryLoading(false);
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

  const handleSuggestionSelect = (value: string) => {
    setQuery(value);
    setSearchParams({ q: value });
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
        <h1 className="font-display text-2xl font-bold text-foreground mb-6 sm:text-3xl">Search Articles</h1>

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
                      onClick={() => handleSuggestionSelect(item.label)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent-foreground">
                        {item.type === "category" ? <Folder className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
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
            {results.length} result{results.length !== 1 ? "s" : ""} for "
            <span className="font-medium text-foreground">{effectiveQuery}</span>"
          </p>
        )}

        {categoryError && (
          <div className="mb-6 rounded-2xl border border-border/70 bg-destructive/10 p-4 text-sm text-destructive">
            {categoryError}
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
                      <p className="mb-1 inline-flex rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {category.short_code}
                      </p>
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

        {effectiveQuery && !categoryLoading && categoryResults.length === 0 && results.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-center sm:p-10">
            <p className="text-muted-foreground">No results found. Try a different search term.</p>
          </div>
        )}

        {!effectiveQuery && (
          <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-center sm:p-10">
            <Search className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Enter a search term to find articles.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SearchPage;
