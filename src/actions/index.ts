import { createEvent, updateEvent, getLocations, getVenues } from './events';
import { createPost, updatePost } from './posts';
import { createMember } from './members';
import { signup } from './signup';
import { changePassword } from './changePassword';
import { updateUsername } from './updateUsername';

export const server = {
  createEvent,
  updateEvent,
  getLocations,
  getVenues,
  createPost,
  updatePost,
  createMember,
  signup,
  changePassword,
  updateUsername,
};
