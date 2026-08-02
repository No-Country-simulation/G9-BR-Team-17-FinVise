export const retrievalDepthOptions = [
  { value: 3, label: 'Mínimo', description: '3 evidências · resposta direta' },
  { value: 5, label: 'Equilibrado', description: '5 evidências · recomendado' },
  { value: 10, label: 'Estendido', description: '10 evidências · mais contexto' },
  { value: 15, label: 'Máximo', description: '15 evidências · busca mais ampla' },
];

export function retrievalDepthLabel(topK: number) {
  return retrievalDepthOptions.find((option) => option.value === topK)?.label ?? 'Personalizada';
}
