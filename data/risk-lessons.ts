export type AllocationItem = {
  label: string;
  percentage: number;
  color: string;
};

export type RiskExample = {
  title: string;
  riskLevel: "Lower" | "Moderate" | "Higher";
  description: string;
  allocations: readonly AllocationItem[];
  lesson: string;
};

export type VolatilityExample = {
  label: string;
  movementPercent: number;
  explanation: string;
};

export const riskExamples: readonly RiskExample[] = [
  {
    title: "Concentrated fictional portfolio",
    riskLevel: "Higher",
    description:
      "Most virtual funds are assigned to one fictional market.",
    allocations: [
      {
        label: "Fictional Technology Index",
        percentage: 80,
        color: "#1cceff",
      },
      {
        label: "Fictional Defensive Index",
        percentage: 15,
        color: "#35e69a",
      },
      {
        label: "Virtual cash reserve",
        percentage: 5,
        color: "#ffbe5c",
      },
    ],
    lesson:
      "Large exposure to one market can make the whole simulation more sensitive to that market's movement.",
  },
  {
    title: "Diversified fictional portfolio",
    riskLevel: "Moderate",
    description:
      "Virtual funds are distributed across several fictional categories.",
    allocations: [
      {
        label: "Fictional Technology Index",
        percentage: 35,
        color: "#1cceff",
      },
      {
        label: "Fictional Green Energy Index",
        percentage: 25,
        color: "#9b8cff",
      },
      {
        label: "Fictional Defensive Index",
        percentage: 25,
        color: "#35e69a",
      },
      {
        label: "Virtual cash reserve",
        percentage: 15,
        color: "#ffbe5c",
      },
    ],
    lesson:
      "Diversification can spread exposure, but it cannot remove every form of risk.",
  },
  {
    title: "Defensive fictional portfolio",
    riskLevel: "Lower",
    description:
      "A larger virtual reserve reduces exposure to simulated market movement.",
    allocations: [
      {
        label: "Fictional Technology Index",
        percentage: 15,
        color: "#1cceff",
      },
      {
        label: "Fictional Defensive Index",
        percentage: 35,
        color: "#35e69a",
      },
      {
        label: "Virtual cash reserve",
        percentage: 50,
        color: "#ffbe5c",
      },
    ],
    lesson:
      "Lower simulated exposure may reduce volatility, but it does not guarantee a positive result.",
  },
];

export const volatilityExamples: readonly VolatilityExample[] = [
  {
    label: "Small movement",
    movementPercent: 1,
    explanation:
      "The fictional reference value changes only slightly.",
  },
  {
    label: "Moderate movement",
    movementPercent: 4,
    explanation:
      "The fictional value experiences a more noticeable change.",
  },
  {
    label: "Large movement",
    movementPercent: 9,
    explanation:
      "The fictional value changes sharply and carries greater uncertainty.",
  },
];

export const lossLimitExample = {
  startingBalanceMinor: 10_000_000,
  educationalLimitPercent: 2,
  simulatedLimitMinor: 200_000,
  remainingBalanceMinor: 9_800_000,
} as const;