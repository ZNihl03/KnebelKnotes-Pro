import { useNavigate } from "react-router-dom";
import { Search, BookOpen, Stethoscope, FlaskConical, Folder } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { searchArticles, type Article } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";
import { supabase } from "@/lib/supabaseClient";

type CategoryResult = {
  id: string;
  name: string;
  description: string | null;
};

const Index = () => {
  const [query, setQuery] = useState("");
  const [categoryResults, setCategoryResults] = useState<CategoryResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const effectiveQuery = query.trim();
  const articleResults = useMemo(() => (effectiveQuery ? searchArticles(effectiveQuery) : []), [effectiveQuery]);
  const suggestions = useMemo(() => {
    if (!effectiveQuery) return [];
    const categorySuggestions = categoryResults.map((category) => ({
      type: "category" as const,
      label: category.name,
      id: category.id,
    }));
    const articleSuggestions = (articleResults as Article[]).map((article) => ({
      type: "article" as const,
      label: article.title,
      id: article.id,
    }));
    return [...categorySuggestions, ...articleSuggestions].slice(0, 6);
  }, [effectiveQuery, categoryResults, articleResults]);

  useEffect(() => {
    let isMounted = true;
    const searchTerm = effectiveQuery;

    const fetchCategories = async () => {
      if (!searchTerm) {
        setCategoryResults([]);
        return;
      }

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, description")
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order("name", { ascending: true })
        .limit(8);

      if (!isMounted) return;
      if (error) {
        setCategoryResults([]);
        return;
      }

      setCategoryResults(data ?? []);
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
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
    setShowSuggestions(false);
  };

  const handleSuggestionSelect = (value: string) => {
    setQuery(value);
    setShowSuggestions(false);
    navigate(`/search?q=${encodeURIComponent(value)}`);
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
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/80 via-foreground/70 to-background" />
        <div className="container relative z-10 py-24 md:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-4xl font-bold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl text-balance">
              Clinical Psychiatry Reference
            </h1>
            <p className="mt-4 text-lg text-primary-foreground/80 md:text-xl">
              Evidence-based diagnostic criteria, treatment algorithms, and medication guides for mental health practitioners.
            </p>
            <form
              onSubmit={handleSearch}
              className="mt-8 flex rounded-xl bg-card/95 backdrop-blur p-1.5 shadow-lg"
            >
              <div className="relative flex flex-1 items-center gap-2 px-3">
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
                  className="flex-1 bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
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
                            {item.type === "category" ? (
                              <Folder className="h-3.5 w-3.5" />
                            ) : (
                              <Search className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <span className="flex-1 truncate">{item.label}</span>
                          <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button type="submit" className="shrink-0">
                Search
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-16">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              icon: BookOpen,
              title: "DSM-5 Criteria",
              desc: "Complete diagnostic criteria with clinical notes and differential diagnosis guidance.",
            },
            {
              icon: Stethoscope,
              title: "Treatment Algorithms",
              desc: "Step-by-step treatment flowcharts based on the latest clinical evidence and guidelines.",
            },
            {
              icon: FlaskConical,
              title: "Pharmacotherapy",
              desc: "Comprehensive medication tables with dosing, side effects, and drug interactions.",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className="flex gap-4 animate-fade-in"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </Layout>
  );
};

export default Index;
