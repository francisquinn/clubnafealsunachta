import { createEvent, updateEvent, getChapters, getVenues, getEventLive } from './events';
import { createPost, updatePost } from './posts';
import { createBook, updateBook } from './books';
import { createMember } from './members';
import { signup } from './signup';
import { changePassword } from './changePassword';
import { requestPasswordReset, resetPassword } from './passwordReset';
import { updateUsername } from './updateUsername';
import { updateChapterMemberships } from './chapterMembers';
import { getEventRsvps, setEventRsvp } from './rsvps';
import { uploadAvatar } from './avatar';

export const server = {
  createEvent,
  updateEvent,
  getChapters,
  getVenues,
  getEventLive,
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
  updateChapterMemberships,
  getEventRsvps,
  setEventRsvp,
  uploadAvatar,
};
