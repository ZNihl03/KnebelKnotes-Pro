import { richTextHasContent, sanitizeRichText } from "@/lib/richText";

export const ASSESSMENT_FIELD_DEFAULTS = {
  assessment_initial_response: "<p>At 2-4 weeks (since at therapeutic range)...</p>",
  assessment_change_treatment:
    "<p><strong>Before changing treatment, assess...</strong></p><ul><li>Adherence, dose adequacy, psychiatric/medical comorbidities, psychosocial stressors, drug interactions, +/- pharmacogenetic properties</li><li>Consider adding psychotherapy early depending on patient preference (See Table 3.2)</li><li>If intolerable side effects cannot be mitigated, then switch (see Step 4)</li><li>If medication tolerated, can either...</li></ul><ol type=\"i\"><li>Increase dose (see Step 3.2)</li><li>Switch to agent of superiority (see Step 4.1)</li></ol>",
  assessment_dose_optimization:
    "<p>After completing initial trial (6-8 weeks @ a therapeutic dose)...</p><p>If &lt;20% reduction of symptoms, go back to 3.1.2</p><p>If &gt;20% reduction of symptoms...</p><ul><li>Optimize dose to maximize symptom reduction</li><li>Increase dose (in increments of initiation dose) every 4-6 weeks, assessing tolerance and symptom reduction at each step</li><li>If persistent side effects arise, balance significance of residual symptoms VS tolerance of side effects. Adjust dose for optimal balance</li></ul>",
} as const;

export type AssessmentEditableField = keyof typeof ASSESSMENT_FIELD_DEFAULTS;

export const getAssessmentDisplayContent = (
  field: AssessmentEditableField,
  value: string,
) => {
  const normalizedValue = sanitizeRichText(value);
  return richTextHasContent(normalizedValue) ? normalizedValue : ASSESSMENT_FIELD_DEFAULTS[field];
};
