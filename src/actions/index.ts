import { createEvent, updateEvent, getLocations, getVenues } from './events';
import { createPost, updatePost } from './posts';
import { createMember } from './members';
import { signup } from './signup';

export const server = {
  createEvent,
  updateEvent,
  getLocations,
  getVenues,
  createPost,
  updatePost,
  createMember,
  signup,
};
