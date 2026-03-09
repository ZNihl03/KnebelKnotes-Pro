export type DoseBasedMedication = {
  drug_name: string;
  line_of_treatment: number;
  initiation_dose_mg: number;
  therapeutic_min_dose_mg: number;
  therapeutic_max_dose_mg: number;
  max_dose_mg: number;
};

export type ProgressionResponse = "none" | "partial" | "adequate";
export type ProgressionTolerability = "tolerating" | "mild_side_effects" | "intolerable";

export type ProgressionInputs = {
  currentDoseMg: number;
  weeksAtDose: number;
  response: ProgressionResponse;
  tolerability: ProgressionTolerability;
};

export type ProgressionRecommendation = {
  title: string;
  summary: string;
  nextDoseMg: number | null;
  bullets: string[];
  band: "starting" | "subtherapeutic" | "therapeutic" | "upper" | "max";
};

const STEP_CANDIDATES = [25, 20, 10, 5, 1];

export const formatDoseMg = (value: number) => `${value} mg`;

export const formatDoseRangeMg = (min: number, max: number) => `${min}-${max} mg`;

export const inferDoseStepMg = (drug: DoseBasedMedication) => {
  const checkpoints = [
    drug.initiation_dose_mg,
    drug.therapeutic_min_dose_mg,
    drug.therapeutic_max_dose_mg,
    drug.max_dose_mg,
  ];

  return STEP_CANDIDATES.find((step) => checkpoints.every((value) => value % step === 0)) ?? 1;
};

export const buildDoseOptionsMg = (drug: DoseBasedMedication) => {
  const step = inferDoseStepMg(drug);
  const options: number[] = [];

  for (let dose = 0; dose <= drug.max_dose_mg; dose += step) {
    options.push(dose);
  }

  if (options[options.length - 1] !== drug.max_dose_mg) {
    options.push(drug.max_dose_mg);
  }

  return options;
};

export const getDoseBand = (drug: DoseBasedMedication, currentDoseMg: number) => {
  if (currentDoseMg < drug.initiation_dose_mg) return "starting" as const;
  if (currentDoseMg < drug.therapeutic_min_dose_mg) return "subtherapeutic" as const;
  if (currentDoseMg <= drug.therapeutic_max_dose_mg) return "therapeutic" as const;
  if (currentDoseMg < drug.max_dose_mg) return "upper" as const;
  return "max" as const;
};

export const buildProgressionRecommendation = (
  drug: DoseBasedMedication,
  inputs: ProgressionInputs,
): ProgressionRecommendation => {
  const step = inferDoseStepMg(drug);
  const band = getDoseBand(drug, inputs.currentDoseMg);
  const adequateTrial = inputs.weeksAtDose >= 4 && inputs.currentDoseMg >= drug.therapeutic_min_dose_mg;
  const nextDoseWithinRange = Math.min(inputs.currentDoseMg + step, drug.therapeutic_max_dose_mg);
  const nextDoseOverall = Math.min(inputs.currentDoseMg + step, drug.max_dose_mg);

  if (inputs.tolerability === "intolerable") {
    return {
      title: "Do not escalate",
      summary: `The current dose of ${formatDoseMg(inputs.currentDoseMg)} is not tolerated.`,
      nextDoseMg: inputs.currentDoseMg > drug.initiation_dose_mg ? Math.max(inputs.currentDoseMg - step, 0) : null,
      band,
      bullets: [
        "Reduce the dose or switch rather than increasing further.",
        "Document the limiting adverse effect before changing the regimen.",
        "If symptoms remain severe, consider an alternative agent or supervised cross-taper.",
      ],
    };
  }

  if (inputs.tolerability === "mild_side_effects") {
    return {
      title: "Hold before further titration",
      summary: `Mild side effects are present at ${formatDoseMg(inputs.currentDoseMg)}.`,
      nextDoseMg: null,
      band,
      bullets: [
        "Stabilize at the current dose until side effects settle.",
        "Escalate only if benefits outweigh tolerability burden.",
        "Use the therapeutic range and response status to reassess at the next review.",
      ],
    };
  }

  if (inputs.response === "adequate") {
    return {
      title: "Maintain the current regimen",
      summary:
        band === "subtherapeutic" || band === "starting"
          ? `The patient is responding at ${formatDoseMg(inputs.currentDoseMg)}, even though this is below the usual therapeutic range.`
          : `The patient is responding adequately at ${formatDoseMg(inputs.currentDoseMg)}.`,
      nextDoseMg: null,
      band,
      bullets: [
        "Do not increase automatically if clinical response is already adequate.",
        `Monitor for relapse and tolerability within the usual range of ${formatDoseRangeMg(
          drug.therapeutic_min_dose_mg,
          drug.therapeutic_max_dose_mg,
        )}.`,
        "If symptoms recur, reassess dose and duration before switching.",
      ],
    };
  }

  if (band === "starting") {
    return {
      title: "Reach the initiation dose first",
      summary: `Current dose ${formatDoseMg(inputs.currentDoseMg)} is below the recommended initiation dose of ${formatDoseMg(drug.initiation_dose_mg)}.`,
      nextDoseMg: drug.initiation_dose_mg,
      band,
      bullets: [
        "Escalate to the initiation dose before judging response.",
        "Reassess tolerability during the first one to two weeks.",
        "Do not interpret lack of response at a sub-initiation dose as treatment failure.",
      ],
    };
  }

  if (band === "subtherapeutic") {
    return {
      title: "Increase toward the therapeutic range",
      summary: `Current dose ${formatDoseMg(inputs.currentDoseMg)} is below the therapeutic range of ${formatDoseRangeMg(
        drug.therapeutic_min_dose_mg,
        drug.therapeutic_max_dose_mg,
      )}.`,
      nextDoseMg: nextDoseWithinRange,
      band,
      bullets: [
        "Increase dose stepwise until the patient reaches at least the therapeutic minimum.",
        "Use response only after the patient has had adequate time at a therapeutic dose.",
        "Continue monitoring tolerability at each increment.",
      ],
    };
  }

  if (!adequateTrial) {
    return {
      title: "Complete an adequate trial",
      summary: `The patient is within the therapeutic range but has been at the current dose for only ${inputs.weeksAtDose} week(s).`,
      nextDoseMg: null,
      band,
      bullets: [
        "Hold the dose long enough to judge response properly.",
        "Avoid switching too early while the patient is still in an adequate range.",
        "If symptoms worsen or tolerability changes, reassess sooner.",
      ],
    };
  }

  if (inputs.response === "partial") {
    if (inputs.currentDoseMg < drug.therapeutic_max_dose_mg) {
      return {
        title: "Increase within the therapeutic range",
        summary: `Partial response at ${formatDoseMg(inputs.currentDoseMg)} suggests additional room to optimize before switching.`,
        nextDoseMg: nextDoseWithinRange,
        band,
        bullets: [
          "Increase toward the upper therapeutic range if tolerated.",
          "Reassess after another adequate interval at the higher dose.",
          "If partial response persists near the top of range, consider augmentation or switching.",
        ],
      };
    }

    if (inputs.currentDoseMg < drug.max_dose_mg) {
      return {
        title: "Final optimization decision",
        summary: `The patient is already at the upper therapeutic range (${formatDoseMg(inputs.currentDoseMg)}).`,
        nextDoseMg: nextDoseOverall > inputs.currentDoseMg ? nextDoseOverall : null,
        band,
        bullets: [
          "Only escalate beyond the usual therapeutic ceiling if clinically justified and tolerated.",
          "Compare a final dose increase against the option to augment or switch.",
          "Document why a supra-therapeutic trial is or is not appropriate.",
        ],
      };
    }

    return {
      title: "Move beyond dose escalation",
      summary: `Partial response persists at the maximum dose of ${formatDoseMg(drug.max_dose_mg)}.`,
      nextDoseMg: null,
      band,
      bullets: [
        "Further dose escalation is not available.",
        "Consider augmentation, switching, or reassessing the diagnosis and adherence.",
        "Use the audit trail to capture the rationale for the next step.",
      ],
    };
  }

  if (inputs.currentDoseMg < drug.therapeutic_max_dose_mg) {
    return {
      title: "Increase toward the upper therapeutic range",
      summary: `No meaningful response after an adequate trial at ${formatDoseMg(inputs.currentDoseMg)}.`,
      nextDoseMg: nextDoseWithinRange,
      band,
      bullets: [
        "Increase dose stepwise while staying within the therapeutic range.",
        "Reassess after another adequate trial at the higher dose.",
        "If no response persists at the top of range, prepare to switch or augment.",
      ],
    };
  }

  if (inputs.currentDoseMg < drug.max_dose_mg) {
    return {
      title: "Consider a last justified increase or switch",
      summary: `The patient has no meaningful response near the top of range at ${formatDoseMg(inputs.currentDoseMg)}.`,
      nextDoseMg: nextDoseOverall > inputs.currentDoseMg ? nextDoseOverall : null,
      band,
      bullets: [
        "Escalate beyond the usual therapeutic ceiling only with a clear clinical rationale.",
        "If risk outweighs benefit, switch or augment instead of increasing.",
        "Review adherence, duration, and diagnosis before concluding treatment failure.",
      ],
    };
  }

  return {
    title: "Maximum dose reached",
    summary: `No meaningful response at the maximum dose of ${formatDoseMg(drug.max_dose_mg)}.`,
    nextDoseMg: null,
    band,
    bullets: [
      "Do not escalate further.",
      "Consider switching, augmentation, or diagnostic reassessment.",
      "Document the failed adequate trial in the audit history.",
    ],
  };
};
