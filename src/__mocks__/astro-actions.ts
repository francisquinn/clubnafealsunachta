export const actions = {
  createEvent: () => Promise.resolve({ data: { success: true } }),
  getChapters: () => Promise.resolve({ data: [{ id: 1, name: "Trieste", slug: "trieste" }] }),
  getVenues: () => Promise.resolve({ data: [] }),
};
