import { createEvent, updateEvent, getClubs, getVenues } from './events';
import { createPost, updatePost } from './posts';
import { createBook, updateBook } from './books';
import { createMember } from './members';
import { signup } from './signup';
import { changePassword } from './changePassword';
import { requestPasswordReset, resetPassword } from './passwordReset';
import { updateUsername } from './updateUsername';
import { updateClubMemberships } from './clubMembers';
import { getEventRsvps, setEventRsvp } from './rsvps';
import { uploadAvatar } from './avatar';

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
  requestPasswordReset,
  resetPassword,
  updateUsername,
  updateClubMemberships,
  getEventRsvps,
  setEventRsvp,
  uploadAvatar,
};
