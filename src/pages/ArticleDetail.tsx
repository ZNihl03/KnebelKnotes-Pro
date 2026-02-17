import { useParams, Link } from "react-router-dom";
import { ChevronRight, Clock, User, Tag } from "lucide-react";
import Layout from "@/components/Layout";
import { getArticleBySlug, getCategoryById, categories } from "@/data/mockData";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Simple markdown-like renderer
const renderContent = (content: string) => {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  const flushTable = () => {
    if (tableHeaders.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="my-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {tableHeaders.map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-left font-semibold text-foreground">
                    {h.replace(/\*\*/g, "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2 text-muted-foreground">
                      <span dangerouslySetInnerHTML={{
                        __html: cell.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
                      }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableHeaders = [];
    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.startsWith("|")) {
      const cells = line.split("|").filter(Boolean).map((c) => c.trim());
      if (!inTable) {
        tableHeaders = cells;
        inTable = true;
        continue;
      }
      if (cells.every((c) => /^[-:]+$/.test(c))) continue; // separator
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} id={line.slice(3).toLowerCase().replace(/\s+/g, "-")} className="mt-8 mb-3 font-display text-xl font-bold text-foreground scroll-mt-20">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="mt-6 mb-2 font-display text-lg font-semibold text-foreground">
          {line.slice(4)}
        </h3>
      );
    } else if (/^\d+\.\s\*\*/.test(line)) {
      const html = line.replace(/^\d+\.\s/, "").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      elements.push(
        <li key={i} className="ml-4 mb-1 text-sm text-muted-foreground list-decimal" dangerouslySetInnerHTML={{ __html: html }} />
      );
    } else if (line.startsWith("- **")) {
      const html = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>');
      elements.push(
        <li key={i} className="ml-4 mb-1 text-sm text-muted-foreground list-disc" dangerouslySetInnerHTML={{ __html: html }} />
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <li key={i} className="ml-4 mb-1 text-sm text-muted-foreground list-disc">
          {line.slice(2)}
        </li>
      );
    } else if (line.trim() === "") {
      // skip
    } else {
      const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      elements.push(
        <p key={i} className="mb-2 text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
      );
    }
  }

  if (inTable) flushTable();
  return elements;
};

const ArticleDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = getArticleBySlug(slug || "");
  const category = article ? getCategoryById(article.categoryId) : null;
  const parentCategory = category?.parentId
    ? categories.find((c) => c.id === category.parentId)
    : null;

  if (!article) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Article not found</h1>
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
            ← Back to home
          </Link>
        </div>
      </Layout>
    );
  }

  // Extract sections for accordion
  const sections = article.content.split(/(?=^## )/m).filter(Boolean);

  return (
    <Layout>
      <div className="container max-w-4xl py-10">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {parentCategory && (
            <>
              <Link to={`/category/${parentCategory.id}`} className="hover:text-foreground transition-colors">
                {parentCategory.title}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          )}
          {category && (
            <>
              <Link to={`/category/${category.id}`} className="hover:text-foreground transition-colors">
                {category.title}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          )}
          <span className="text-foreground font-medium truncate max-w-[200px]">{article.title}</span>
        </nav>

        {/* Article header */}
        <header className="mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground text-balance">
            {article.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {article.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Updated {article.updatedAt}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        </header>

        {/* Content — accordion sections */}
        {sections.length > 1 ? (
          <Accordion type="multiple" defaultValue={sections.map((_, i) => `section-${i}`)} className="space-y-2">
            {sections.map((section, i) => {
              const titleMatch = section.match(/^## (.+)/);
              const title = titleMatch ? titleMatch[1] : `Section ${i + 1}`;
              const body = titleMatch ? section.replace(/^## .+\n*/, "") : section;
              return (
                <AccordionItem
                  key={i}
                  value={`section-${i}`}
                  className="rounded-xl border border-border bg-card px-5 data-[state=open]:shadow-sm"
                >
                  <AccordionTrigger className="font-display text-base font-semibold text-foreground hover:no-underline py-4">
                    {title}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    {renderContent(body)}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <article className="rounded-xl border border-border bg-card p-6 md:p-8">
            {renderContent(article.content)}
          </article>
        )}
      </div>
    </Layout>
  );
};

export default ArticleDetail;
