import { useSearchParams, Link } from "react-router-dom";
import { Search, Clock, Tag } from "lucide-react";
import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { searchArticles } from "@/data/mockData";
import { Button } from "@/components/ui/button";

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);

  const results = useMemo(
    () => (initialQuery ? searchArticles(initialQuery) : []),
    [initialQuery]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    }
  };

  return (
    <Layout>
      <div className="container max-w-3xl py-12">
        <h1 className="font-display text-3xl font-bold text-foreground mb-6">Search Articles</h1>

        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search disorders, medications, criteria..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        {initialQuery && (
          <p className="mb-6 text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} for "
            <span className="font-medium text-foreground">{initialQuery}</span>"
          </p>
        )}

        <div className="space-y-3">
          {results.map((article, i) => (
            <Link
              key={article.id}
              to={`/article/${article.slug}`}
              className="group block rounded-xl border border-border bg-card p-5 transition-all hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-0.5 animate-fade-in"
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

        {initialQuery && results.length === 0 && (
          <div className="rounded-xl border border-border bg-muted/50 p-10 text-center">
            <p className="text-muted-foreground">No articles found. Try a different search term.</p>
          </div>
        )}

        {!initialQuery && (
          <div className="rounded-xl border border-border bg-muted/50 p-10 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Enter a search term to find articles.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SearchPage;
