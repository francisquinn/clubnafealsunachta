export function formatDate(date: Date): string {
  return `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getDate()}, ${date.getFullYear()} `;
}