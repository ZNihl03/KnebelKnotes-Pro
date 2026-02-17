import { Link } from "react-router-dom";
import { ChevronRight, Cloud, Activity, Brain, TrendingUp, Shield, Puzzle, Pill, Users, FileText } from "lucide-react";
import type { Category } from "@/data/mockData";

const iconMap: Record<string, React.ElementType> = {
  Cloud, Activity, Brain, TrendingUp, Shield, Puzzle, Pill, Users, FileText,
};

const CategoryCard = ({ category, index = 0 }: { category: Category; index?: number }) => {
  const Icon = iconMap[category.icon] || FileText;

  return (
    <Link
      to={`/category/${category.id}`}
      className="group relative flex flex-col rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-base font-semibold text-foreground mb-1.5">
        {category.title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">
        {category.description}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {category.articleCount} articles
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>
    </Link>
  );
};

export default CategoryCard;
