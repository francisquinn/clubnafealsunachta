import { createEvent, updateEvent, getChapters, getVenues, getEventLive } from './events';
import { createPost, updatePost } from './posts';
import { createBook, updateBook } from './books';
import { createMember } from './members';
import { signup } from './signup';
import { changePassword } from './changePassword';
import { requestPasswordReset, resetPassword } from './passwordReset';
import { updateUsername } from './updateUsername';
import { updateChapterMemberships, joinChapter, leaveChapter, getChapterMembership, setChapterEmails } from './chapterMembers';
import { getEventRsvps, setEventRsvp } from './rsvps';
import { uploadAvatar } from './avatar';
import { deleteAccount } from './deleteAccount';
import { resendVerification } from './resendVerification';

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
  joinChapter,
  leaveChapter,
  getChapterMembership,
  setChapterEmails,
  getEventRsvps,
  setEventRsvp,
  uploadAvatar,
  deleteAccount,
  resendVerification,
};
