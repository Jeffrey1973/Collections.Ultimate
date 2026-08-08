/**
 * Canonical lookup IDs — the SINGLE source of truth for the frontend.
 *
 * These values are transcribed from the PRODUCTION database (verified 2026-08-08 via
 * ops/diagnose.sql). They are not a guess at "common library standards" — they are what
 * the FK constraints actually enforce. If these disagree with the database, the database
 * wins and this file is the bug.
 *
 * Previously three incompatible maps existed (web/src/api/backend.ts,
 * web/src/pages/BookEditPage.tsx, and the DB seed), so the same identifier was written
 * under different IDs depending on which page saved it. See ops/README.md.
 *
 * DO NOT add IDs here that do not exist in dbo.IdentifierType / dbo.ContributorRole /
 * dbo.SubjectScheme. A missing row is an FK violation that surfaces as a 500 and silently
 * discards the user's value — that is exactly how DOI writes were being lost.
 */

/**
 * dbo.IdentifierType. Note the gaps and duplicates, which are real:
 *  - There is NO id 6. The old frontend maps used 6 for DOI, so every DOI write
 *    failed the FK check and the value vanished. DOI is 10.
 *  - OCLC appears at BOTH 4 and 8. Use 4 for new writes. Id 8 currently holds ~1,646
 *    Google Books volume IDs that were misfiled there and must be remapped to 11
 *    BEFORE the duplicate lookup row is retired.
 */
export const IdentifierType = {
  ISBN10: 1,
  ISBN13: 2,
  ASIN: 3,
  OCLC: 4,
  LCCN: 5,
  ISSN: 7,
  OCLCWorkId: 9,
  DOI: 10,
  GoogleBooksId: 11,
  GoodreadsId: 12,
  LibraryThingId: 13,
  OpenLibraryId: 14,
  DNB: 15,
  BNF: 16,
  NLA: 17,
  NDL: 18,
  LAC: 19,
  BL: 20,
} as const

/**
 * dbo.ContributorRole.
 *
 * The old map had Illustrator/Translator swapped, Narrator/Contributor swapped, and was
 * off by one from 7 upward. Only RoleId 1 (Author) has ever been written — 7,165 rows,
 * all correct — so there is no historical damage to repair here, but every non-Author
 * role would have been misfiled going forward.
 *
 * There is no "Introduction" role in the database; callers should fall back to
 * Contributor rather than inventing an ID.
 */
export const ContributorRole = {
  Author: 1,
  Editor: 2,
  Illustrator: 3,
  Translator: 4,
  Narrator: 5,
  Contributor: 6,
  Foreword: 7,
  Afterword: 8,
  Photographer: 9,
  Designer: 10,
} as const

/** dbo.SubjectScheme. This one already matched production. BISAC is duplicated at 5. */
export const SubjectScheme = {
  LCSH: 1,
  BISAC: 2,
  Custom: 3,
  LCC: 4,
  Thema: 6,
  FAST: 7,
} as const
