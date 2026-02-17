export interface Category {
  id: string;
  title: string;
  description: string;
  icon: string;
  parentId: string | null;
  articleCount: number;
}

export interface Article {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  updatedAt: string;
  author: string;
  tags: string[];
}

export const categories: Category[] = [
  {
    id: "depressive",
    title: "Depressive Disorders",
    description: "Major depressive disorder, persistent depressive disorder, and related conditions",
    icon: "Cloud",
    parentId: null,
    articleCount: 12,
  },
  {
    id: "anxiety",
    title: "Anxiety Disorders",
    description: "Generalized anxiety, panic disorder, social anxiety, and phobias",
    icon: "Activity",
    parentId: null,
    articleCount: 9,
  },
  {
    id: "psychotic",
    title: "Psychotic Disorders",
    description: "Schizophrenia spectrum and other psychotic conditions",
    icon: "Brain",
    parentId: null,
    articleCount: 7,
  },
  {
    id: "bipolar",
    title: "Bipolar & Related Disorders",
    description: "Bipolar I, Bipolar II, cyclothymic disorder",
    icon: "TrendingUp",
    parentId: null,
    articleCount: 6,
  },
  {
    id: "trauma",
    title: "Trauma & Stressor-Related",
    description: "PTSD, acute stress disorder, adjustment disorders",
    icon: "Shield",
    parentId: null,
    articleCount: 5,
  },
  {
    id: "neurodevelopmental",
    title: "Neurodevelopmental Disorders",
    description: "ADHD, autism spectrum, intellectual disabilities",
    icon: "Puzzle",
    parentId: null,
    articleCount: 8,
  },
  {
    id: "substance",
    title: "Substance-Related Disorders",
    description: "Substance use disorders and addiction medicine",
    icon: "Pill",
    parentId: null,
    articleCount: 10,
  },
  {
    id: "personality",
    title: "Personality Disorders",
    description: "Cluster A, B, and C personality disorders",
    icon: "Users",
    parentId: null,
    articleCount: 6,
  },
  // Sub-categories
  {
    id: "mdd",
    title: "Major Depressive Disorder",
    description: "Diagnostic criteria, treatment algorithms, and pharmacotherapy",
    icon: "FileText",
    parentId: "depressive",
    articleCount: 5,
  },
  {
    id: "pdd",
    title: "Persistent Depressive Disorder",
    description: "Chronic depressive conditions and dysthymia",
    icon: "FileText",
    parentId: "depressive",
    articleCount: 3,
  },
  {
    id: "gad",
    title: "Generalized Anxiety Disorder",
    description: "Excessive worry, diagnostic criteria and management",
    icon: "FileText",
    parentId: "anxiety",
    articleCount: 4,
  },
  {
    id: "panic",
    title: "Panic Disorder",
    description: "Panic attacks, agoraphobia, and treatment approaches",
    icon: "FileText",
    parentId: "anxiety",
    articleCount: 3,
  },
];

export const articles: Article[] = [
  {
    id: "mdd-criteria",
    categoryId: "mdd",
    title: "DSM-5 Diagnostic Criteria for Major Depressive Disorder",
    slug: "mdd-diagnostic-criteria",
    excerpt: "A comprehensive overview of the DSM-5 diagnostic criteria for Major Depressive Disorder, including specifiers and severity ratings.",
    content: `## Overview

Major Depressive Disorder (MDD) is characterized by the presence of at least **5 of the following symptoms** during the same 2-week period, representing a change from previous functioning. At least one of the symptoms must be either (1) depressed mood or (2) loss of interest or pleasure.

## DSM-5 Diagnostic Criteria

### Criterion A — Symptom Criteria
At least 5 of the following symptoms present during a 2-week period:

1. **Depressed mood** most of the day, nearly every day (subjective report or observation)
2. **Markedly diminished interest or pleasure** in all, or almost all, activities
3. **Significant weight loss/gain** (>5% change in a month) or appetite change
4. **Insomnia or hypersomnia** nearly every day
5. **Psychomotor agitation or retardation** (observable by others)
6. **Fatigue or loss of energy** nearly every day
7. **Feelings of worthlessness** or excessive/inappropriate guilt
8. **Diminished ability to think or concentrate**, or indecisiveness
9. **Recurrent thoughts of death**, suicidal ideation, or suicide attempt

### Criterion B
The symptoms cause clinically significant distress or impairment in social, occupational, or other important areas of functioning.

### Criterion C
The episode is not attributable to the physiological effects of a substance or another medical condition.

## Severity Specifiers

| Severity | Criteria |
|----------|----------|
| **Mild** | Few symptoms beyond the minimum required, minor functional impairment |
| **Moderate** | Symptoms and functional impairment between mild and severe |
| **Severe** | Most criteria present, significant impairment, may include psychotic features |

## Treatment Algorithm

### First-Line Treatment
- **SSRIs**: Escitalopram, Sertraline, Fluoxetine
- **SNRIs**: Venlafaxine, Duloxetine
- **Psychotherapy**: CBT, IPT

### Second-Line Treatment
- Switch SSRI/SNRI class
- Augmentation with atypical antipsychotic
- Consider combination therapy

### Third-Line Treatment
- MAOIs
- ECT for treatment-resistant cases
- Ketamine/esketamine (Spravato)`,
    updatedAt: "2025-12-15",
    author: "Dr. Sarah Mitchell",
    tags: ["DSM-5", "Diagnosis", "MDD", "Criteria"],
  },
  {
    id: "mdd-pharmacotherapy",
    categoryId: "mdd",
    title: "Pharmacotherapy for Major Depressive Disorder",
    slug: "mdd-pharmacotherapy",
    excerpt: "Evidence-based medication management strategies for MDD including first-line agents, augmentation, and treatment-resistant approaches.",
    content: `## First-Line Pharmacotherapy\n\nSSRIs and SNRIs remain the first-line pharmacotherapy for MDD due to their efficacy, tolerability, and safety profiles.\n\n### SSRI Comparison Table\n\n| Medication | Starting Dose | Target Dose | Key Considerations |\n|-----------|--------------|-------------|--------------------|\n| Escitalopram | 10mg | 10-20mg | Best tolerability |\n| Sertraline | 50mg | 50-200mg | Fewest drug interactions |\n| Fluoxetine | 20mg | 20-60mg | Long half-life |`,
    updatedAt: "2025-11-28",
    author: "Dr. James Chen",
    tags: ["Pharmacotherapy", "SSRI", "SNRI", "Medication"],
  },
  {
    id: "gad-overview",
    categoryId: "gad",
    title: "Generalized Anxiety Disorder: Comprehensive Guide",
    slug: "gad-overview",
    excerpt: "Clinical overview of GAD including diagnostic criteria, differential diagnosis, and evidence-based treatment strategies.",
    content: `## Overview\n\nGeneralized Anxiety Disorder (GAD) is characterized by excessive anxiety and worry about a variety of topics, events, or activities, occurring more days than not for at least 6 months.\n\n## Key Features\n- Difficulty controlling the worry\n- Associated with 3 or more symptoms (restlessness, fatigue, concentration difficulties, irritability, muscle tension, sleep disturbance)\n- Causes clinically significant distress`,
    updatedAt: "2025-10-30",
    author: "Dr. Emily Torres",
    tags: ["GAD", "Anxiety", "Diagnosis"],
  },
  {
    id: "panic-disorder",
    categoryId: "panic",
    title: "Panic Disorder: Diagnosis and Management",
    slug: "panic-disorder-management",
    excerpt: "Understanding panic attacks, diagnostic criteria for panic disorder, and cognitive-behavioral and pharmacological interventions.",
    content: `## Panic Attacks\n\nAn abrupt surge of intense fear or discomfort that reaches a peak within minutes, with 4 or more of the following:\n\n1. Palpitations or accelerated heart rate\n2. Sweating\n3. Trembling or shaking\n4. Shortness of breath\n5. Feelings of choking\n6. Chest pain or discomfort\n7. Nausea or abdominal distress\n8. Dizziness or lightheadedness\n9. Chills or heat sensations\n10. Paresthesias\n11. Derealization or depersonalization\n12. Fear of losing control\n13. Fear of dying`,
    updatedAt: "2025-09-22",
    author: "Dr. Michael Park",
    tags: ["Panic", "Anxiety", "CBT"],
  },
  {
    id: "schizophrenia-overview",
    categoryId: "psychotic",
    title: "Schizophrenia: Clinical Overview",
    slug: "schizophrenia-overview",
    excerpt: "Comprehensive review of schizophrenia including positive and negative symptoms, diagnostic criteria, and treatment approaches.",
    content: `## Overview\n\nSchizophrenia is a chronic and severe mental disorder affecting how a person thinks, feels, and behaves.\n\n## Symptom Domains\n\n### Positive Symptoms\n- Hallucinations\n- Delusions\n- Disorganized speech\n- Disorganized or catatonic behavior\n\n### Negative Symptoms\n- Diminished emotional expression\n- Avolition\n- Alogia\n- Anhedonia\n- Asociality`,
    updatedAt: "2025-08-14",
    author: "Dr. Sarah Mitchell",
    tags: ["Schizophrenia", "Psychosis", "Antipsychotics"],
  },
  {
    id: "bipolar-overview",
    categoryId: "bipolar",
    title: "Bipolar Disorder: Diagnosis and Treatment",
    slug: "bipolar-overview",
    excerpt: "Overview of bipolar I and II disorders, manic and hypomanic episodes, and mood stabilizer pharmacotherapy.",
    content: `## Bipolar I vs Bipolar II\n\n| Feature | Bipolar I | Bipolar II |\n|---------|-----------|------------|\n| Mania | Full manic episodes | No full mania |\n| Hypomania | May occur | Required |\n| Depression | Common | Predominant |\n| Hospitalization | Often needed | Less common |`,
    updatedAt: "2025-07-19",
    author: "Dr. James Chen",
    tags: ["Bipolar", "Mania", "Mood Stabilizers"],
  },
];

export const getSubcategories = (parentId: string) =>
  categories.filter((c) => c.parentId === parentId);

export const getRootCategories = () =>
  categories.filter((c) => c.parentId === null);

export const getCategoryById = (id: string) =>
  categories.find((c) => c.id === id);

export const getArticlesByCategory = (categoryId: string) =>
  articles.filter((a) => a.categoryId === categoryId);

export const getArticleBySlug = (slug: string) =>
  articles.find((a) => a.slug === slug);

export const searchArticles = (query: string) => {
  const lower = query.toLowerCase();
  return articles.filter(
    (a) =>
      a.title.toLowerCase().includes(lower) ||
      a.excerpt.toLowerCase().includes(lower) ||
      a.tags.some((t) => t.toLowerCase().includes(lower))
  );
};
