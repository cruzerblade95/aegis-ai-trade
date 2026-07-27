export type EducationalMarket = {
  symbol: string;
  name: string;
  description: string;
  referenceValue: number;
  changePercent: number;
  riskLevel: "Low" | "Medium" | "High";
  lesson: string;
};

export const educationalMarkets: readonly EducationalMarket[] = [
  {
    symbol: "AEG-100",
    name: "Fictional Technology Index",
    description:
      "A simulated group of fictional technology companies.",
    referenceValue: 1245.36,
    changePercent: 1.42,
    riskLevel: "Medium",
    lesson:
      "A rising value does not guarantee that the trend will continue.",
  },
  {
    symbol: "AEG-GRN",
    name: "Fictional Green Energy Index",
    description:
      "A simulated renewable-energy market scenario.",
    referenceValue: 842.18,
    changePercent: -0.76,
    riskLevel: "High",
    lesson:
      "More volatile markets can move quickly in either direction.",
  },
  {
    symbol: "AEG-DEF",
    name: "Fictional Defensive Index",
    description:
      "A simulated collection of lower-volatility businesses.",
    referenceValue: 516.92,
    changePercent: 0.18,
    riskLevel: "Low",
    lesson:
      "Lower volatility does not mean that an asset has no risk.",
  },
];

export const learningScenarios = [
  {
    title: "Trend",
    description:
      "Values move gradually in one direction over several observations.",
    question:
      "What evidence would you need before calling this a reliable trend?",
  },
  {
    title: "Range",
    description:
      "Values repeatedly move between a fictional upper and lower boundary.",
    question:
      "What could cause the value to leave its recent range?",
  },
  {
    title: "Volatility shock",
    description:
      "A fictional event causes unusually large movements.",
    question:
      "How could risk controls reduce the effect of unexpected movement?",
  },
] as const;