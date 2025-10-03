export interface EventData {
  name: string;
  date: string;
  location: string;
  map_url: string;
  links: {
    instagram: string;
    facebook: string;
    meetup?: string;
  }
}