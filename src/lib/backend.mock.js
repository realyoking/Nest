// Mock build only (vite --mode mock aliases backend.real.js to this file). Never deployed.
// Start signed out with ?mock=out, or mid-onboarding with ?mock=new.
import { createMockBackend } from './mock-core.js';
const params = new URLSearchParams(location.search);
const mode = params.get('mock') || sessionStorage.getItem('mockmode') || 'in';
sessionStorage.setItem('mockmode', mode);
const api = createMockBackend({ mode, lang: localStorage.getItem('nest.lang') === 'en' ? 'en' : 'zh-Hant' });
export const {
  MOCK, saveProfile, deleteProfileKeys, auth, onAuth, currentUser, getIdToken, signInGoogle, signInEmail, signInApple, completeRedirect, watchSignInElsewhere, persistedUser, signUpEmail, resetPassword, sendVerifyFallback, reloadUser, signOut, addGoogleAccount, watchProfile, createFamily, getInvite, resolveInviteInput, joinFamily, watchFamily, watchMembers, renameFamily, createInvite, watchInvites, revokeInvite, removeMember, setMemberRole, setMemberRoleFull, updateFamilySettings, updateMyMember, setMemberBirthday, watchPushSubs, deletePushSubMock, leaveFamily, exitFamily, deleteAccount, watchMemories, addMemory, updateMemory, deleteMemory, setMemory, watchReminders, addReminder, updateReminder, deleteReminder, watchUsage, watchConversations, createConversation, touchConversation, updateConversation, listMessages, watchMessages, addMessage, updateMessage, deleteConversation, watchQuizResults, addQuizResult, watchInbox, addInboxItem, updateInboxItem, watchCalendarShares, saveCalendarShare, deleteCalendarShare,
} = api;

export async function changePassword(current, next) { await new Promise((r) => setTimeout(r, 300)); if (current === 'wrong') throw Object.assign(new Error('x'), { code: 'auth/wrong-password' }); return next && true; }
