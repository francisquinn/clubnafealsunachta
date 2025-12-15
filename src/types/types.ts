export type Event = {
  name: string;
  date: string;
  location: string;
  slug: string;
  map_url: string;
  links: {
    instagram: string;
    facebook: string;
    meetup?: string;
  };
};
