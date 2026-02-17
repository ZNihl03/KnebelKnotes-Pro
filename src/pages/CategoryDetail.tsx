import { useParams, Link } from "react-router-dom";
import { ChevronRight, Clock, Tag } from "lucide-react";
import Layout from "@/components/Layout";
import CategoryCard from "@/components/CategoryCard";
import {
  getCategoryById,
  getSubcategories,
  getArticlesByCategory,
  categories,
} from "@/data/mockData";

const CategoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const category = getCategoryById(id || "");
  const subcategories = getSubcategories(id || "");
  const articles = getArticlesByCategory(id || "");

  // Also get articles from subcategories
  const subArticles = subcategories.flatMap((sub) => getArticlesByCategory(sub.id));
  const allArticles = [...articles, ...subArticles];

  const parent = category?.parentId
    ? categories.find((c) => c.id === category.parentId)
    : null;

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
      <div className="container py-10">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/categories" className="hover:text-foreground transition-colors">Categories</Link>
          {parent && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link to={`/category/${parent.id}`} className="hover:text-foreground transition-colors">
                {parent.title}
              </Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{category.title}</span>
        </nav>

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">{category.title}</h1>
          <p className="mt-2 text-muted-foreground">{category.description}</p>
        </div>

        {/* Subcategories */}
        {subcategories.length > 0 && (
          <div className="mb-10">
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Subcategories</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subcategories.map((sub, i) => (
                <CategoryCard key={sub.id} category={sub} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Articles */}
        {allArticles.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">
              Articles ({allArticles.length})
            </h2>
            <div className="space-y-3">
              {allArticles.map((article, i) => (
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
                      Updated {article.updatedAt}
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {article.tags.slice(0, 3).join(", ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {allArticles.length === 0 && subcategories.length === 0 && (
          <div className="rounded-xl border border-border bg-muted/50 p-10 text-center">
            <p className="text-muted-foreground">No articles in this category yet.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CategoryDetail;
