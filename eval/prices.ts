// USD per million input/output tokens, from developers.openai.com/api/docs/models (6 Nov 2026).
export const PRICES: Record<string, [number, number]> = {
  "gpt-6-astra": [10, 50],
  "gpt-6.1-sol": [2, 10],
  "gpt-6.1-terra": [1, 5],
  "gpt-6-luna": [0.1, 0.5],
};
