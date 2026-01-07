export type Event = {
  name: string;
  date: Date;
  location: {
    name: string;
    url: string;
  };
  slug: string;
  social: {
    instagram: string;
    facebook?: string;
    meetup?: string;
  };
};
