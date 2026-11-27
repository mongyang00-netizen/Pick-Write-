// Instructor / teacher email authorized for read-only Teacher View.
// Keep synchronized with firestore.rules isTeacher().
export const TEACHER_EMAIL = 'mongyang00@gmail.com';

export function isAuthorizedTeacher(
  email?: string | null,
  emailVerified?: boolean | null
): boolean {
  if (!email || emailVerified !== true) {
    return false;
  }
  return email.trim().toLowerCase() === TEACHER_EMAIL.toLowerCase();
}
