import { createEvent, updateEvent, getClubs, getVenues } from './events';
import { createPost, updatePost } from './posts';
import { createBook, updateBook } from './books';
import { createMember } from './members';
import { signup } from './signup';
import { changePassword } from './changePassword';
import { updateUsername } from './updateUsername';
import { updateClubMemberships } from './clubMembers';

export const server = {
  createEvent,
  updateEvent,
  getClubs,
  getVenues,
  createPost,
  updatePost,
  createBook,
  updateBook,
  createMember,
  signup,
  changePassword,
  updateUsername,
  updateClubMemberships,
};
