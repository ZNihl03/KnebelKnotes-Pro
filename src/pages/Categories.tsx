import Layout from "@/components/Layout";
import CategoryCard from "@/components/CategoryCard";
import { getRootCategories } from "@/data/mockData";

const Categories = () => {
  const rootCategories = getRootCategories();

  return (
    <Layout>
      <div className="container py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">All Categories</h1>
          <p className="mt-2 text-muted-foreground">
            Browse psychiatric disorders and topics organized by DSM-5 classification.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rootCategories.map((cat, i) => (
            <CategoryCard key={cat.id} category={cat} index={i} />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Categories;
