export const retrievalDepthOptions = [
  { value: 3, label: 'Mínimo', description: '3 evidências' },
  { value: 5, label: 'Equilibrado', description: '5 evidências' },
  { value: 10, label: 'Estendido', description: '10 evidências' },
  { value: 15, label: 'Máximo', description: '15 evidências' },
];

export function retrievalDepthLabel(topK: number) {
  return retrievalDepthOptions.find((option) => option.value === topK)?.label ?? 'Personalizada';
}
