# Security Specification — Pick & Write!

## 1. Data Invariants
1. **Owner-Bound Profiles (`/users/{userId}`)**: A student profile document may only be created, read, or updated by the authenticated user whose `request.auth.uid == userId` (or read by the verified teacher account). New profiles must start at `currentLevel == 1`. `uid` and `createdAt` are immutable after creation.
2. **Owner-Bound Records (`/writingRecords/{recordId}`)**: A writing record may only be created by an authenticated, email-verified user whose `request.auth.uid == incoming().uid`, with `createdAt == request.time`, valid enum `topic` (`food | place | hobby`), `level` and `nextLevel` in `[1, 2, 3]`, and `hintsUsed` in `0..3`.
3. **Strict Student Isolation**: A student (`request.auth.uid`) can ONLY read (`get` and `list`) records where `resource.data.uid == request.auth.uid`. Blanket `list` or `get` queries by other students are denied.
4. **Read-Only Teacher View**: Only the verified teacher email (`mongyang00@gmail.com` with `email_verified == true`) can read (`get` and `list`) all students' records in `/writingRecords/{recordId}` and `/users/{userId}`. Even the teacher cannot mutate or delete students' writing records.
5. **Immutable Saved Records**: Once saved, a `WritingRecord` cannot be updated (`allow update: if false;`), preserving an authentic audit trail of `firstDraft`, `finalParagraph`, `hintsUsed`, and `level`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return `PERMISSION_DENIED`)
1. **Unauthenticated Read**: `get` / `list` `/writingRecords` with `request.auth == null`.
2. **Cross-Student Get**: Student B (`uid: "studentB"`) attempts `get(/writingRecords/recByStudentA)`.
3. **Cross-Student Unfiltered List**: Student B runs `list(/writingRecords)` without `where("uid", "==", "studentB")`.
4. **UID Spoofing on Create**: Student A (`uid: "studentA"`) creates a `WritingRecord` with `uid: "studentB"`.
5. **Teacher Spoofing via Unverified Email**: Attacker signs in with `email: "mongyang00@gmail.com"` and `email_verified: false` and attempts `list(/writingRecords)`.
6. **Shadow / Ghost Field Injection**: Student A creates a `WritingRecord` containing an extra undeclared field `isApproved: true`.
7. **Level Escalation on Profile Create**: Student A creates `/users/studentA` with `currentLevel: 3` instead of starting at `1`.
8. **Invalid Topic Enum**: Student A creates a `WritingRecord` with `topic: "video_games"` (not in `['food', 'place', 'hobby']`).
9. **Denial-of-Wallet String Overflow**: Student A creates a `WritingRecord` with a 10,000-character `firstDraft` (> 2000 limit).
10. **ID Poisoning**: Student A creates `/writingRecords/bad$id/path` or a 200-character document ID.
11. **Timestamp Forgery**: Student A creates a `WritingRecord` with a backdated `createdAt` instead of `request.time`.
12. **Teacher Write / Tamper Attempt**: Teacher account attempts `update` or `delete` on a student's `WritingRecord`.
