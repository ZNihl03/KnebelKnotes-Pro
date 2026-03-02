import Layout from "@/components/Layout";
const Categories = () => {
  return (
    <Layout>
      <div className="container py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">All Categories</h1>
          <p className="mt-2 text-muted-foreground">No categories yet.</p>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-sm text-muted-foreground">
          Sign in to create a new category.
        </div>
      </div>
    </Layout>
  );
};

export default Categories;
