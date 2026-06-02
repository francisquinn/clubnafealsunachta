export const actions = {
  createEvent: () => Promise.resolve({ data: { success: true } }),
  getLocations: () => Promise.resolve({ data: [{ id: 1, name: "Trieste" }, { id: 2, name: "Online" }] }),
  getVenues: () => Promise.resolve({ data: [] }),
};
