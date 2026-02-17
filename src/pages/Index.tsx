import { Link, useNavigate } from "react-router-dom";
import { Search, ArrowRight, BookOpen, Stethoscope, FlaskConical } from "lucide-react";
import { useState } from "react";
import Layout from "@/components/Layout";
import CategoryCard from "@/components/CategoryCard";
import { getRootCategories } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const rootCategories = getRootCategories();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
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
              <div className="flex flex-1 items-center gap-2 px-3">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search disorders, medications, criteria..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
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

      {/* Categories */}
      <section className="container pb-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Browse by Category
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore disorders organized by DSM-5 classification
            </p>
          </div>
          <Link
            to="/categories"
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline md:flex"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rootCategories.map((cat, i) => (
            <CategoryCard key={cat.id} category={cat} index={i} />
          ))}
        </div>
      </section>
    </Layout>
  );
};

export default Index;
