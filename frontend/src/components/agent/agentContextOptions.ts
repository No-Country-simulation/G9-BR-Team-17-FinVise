export const retrievalDepthOptions = [
  { value: 3, label: 'Rápida', description: '3 evidências' },
  { value: 5, label: 'Equilibrada', description: '5 evidências' },
  { value: 8, label: 'Ampla', description: '8 evidências' },
  { value: 10, label: 'Detalhada', description: '10 evidências' },
  { value: 15, label: 'Máxima', description: '15 evidências' },
];

export function retrievalDepthLabel(topK: number) {
  return retrievalDepthOptions.find((option) => option.value === topK)?.label ?? 'Personalizada';
}
