export const actions = {
  createEvent: () => Promise.resolve({ data: { success: true } }),
  getClubs: () => Promise.resolve({ data: [{ id: 1, name: "Trieste", slug: "trieste" }] }),
  getVenues: () => Promise.resolve({ data: [] }),
};
