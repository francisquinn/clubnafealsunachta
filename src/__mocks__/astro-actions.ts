export const actions = {
  createEvent: () => Promise.resolve({ data: { success: true } }),
  getCities: () => Promise.resolve({ data: [{ id: 1, name: "Trieste" }] }),
  getVenues: () => Promise.resolve({ data: [] }),
};
