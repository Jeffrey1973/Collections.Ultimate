# Schema Update - Frontend API Client Alignment

## Summary
Updated the frontend API client and components to match the new OpenAPI 3.0.4 specification provided by the backend.

## Changes Made

### 1. Backend API Client (`src/api/backend.ts`)

#### Added New TypeScript Interfaces
- **ItemKind enum**: Defines item types (1 = Book, 99 = Other)
- **ItemResponse**: Full response from GET /items endpoint including:
  - Item properties (itemId, householdId, kind, barcode, location, status, etc.)
  - Embedded work and edition data
  - Tags array
- **WorkResponse**: Work metadata (workId, title, subtitle, description, contributors)
- **EditionResponse**: Edition metadata (editionId, workId, publisher, publishedYear, pageCount, identifiers)
- **ContributorResponse**: Contributor details (personId, displayName, roleId, ordinal, etc.)
- **IdentifierResponse**: Identifier details (identifierTypeId, value, isPrimary)

#### Updated Functions
- **getItems()**: Changed return type from `Promise<any[]>` to `Promise<ItemResponse[]>`, added logging
- **getItem()**: Changed return type from `Promise<any>` to `Promise<ItemResponse>`
- **getWork()**: New function to fetch work details by ID
- **getEdition()**: New function to fetch edition details by ID
- **getEditionCoverUrl()**: New helper function to generate cover image URLs

### 2. Library Page (`src/pages/LibraryPage.tsx`)

#### Updated Item Mapping
The `loadBooks()` function now properly maps the ItemResponse structure to the frontend Book interface:

```typescript
// Extract work details (title, authors)
const title = item.title || item.work?.title || 'Untitled'
const authors = item.work?.contributors
  ?.sort((a, b) => a.ordinal - b.ordinal)
  .map(c => c.displayName)
  .join(', ') || 'Unknown Author'

// Extract edition details (ISBN, publisher, year, pages)
const isbn13 = item.edition?.identifiers?.find(id => id.identifierTypeId === 2)?.value
const isbn10 = item.edition?.identifiers?.find(id => id.identifierTypeId === 1)?.value
const publisher = item.edition?.publisher
const publishedYear = item.edition?.publishedYear
const pageCount = item.edition?.pageCount
const description = item.work?.description || item.edition?.description

// Generate cover URL if edition exists
const coverImageUrl = item.editionId 
  ? `http://localhost:5258/api/editions/${item.editionId}/cover` 
  : undefined
```

#### Key Improvements
- Correctly extracts title from work object
- Sorts contributors by ordinal and joins display names
- Finds ISBN-10 (typeId=1) and ISBN-13 (typeId=2) from identifiers array
- Uses editionId to construct cover image URL
- Falls back to work description if edition description is unavailable
- Uses acquiredOn date for dateAdded field

### 3. Add Book Page (`src/pages/AddBookPage.tsx`)

No changes needed - the page was already using the correct `CreateBookIngestRequest` format that matches the OpenAPI schema.

## Database Schema (Work/Edition/Item Hierarchy)

The backend uses a three-tier hierarchy:

1. **Work**: The abstract intellectual work (e.g., "Pride and Prejudice")
   - Contains: title, subtitle, description
   - Has: contributors (authors, editors, etc.)

2. **Edition**: A specific published version of a work
   - Contains: publisher, publishedYear, pageCount
   - Has: identifiers (ISBN-10, ISBN-13, LCCN, etc.)
   - May have: cover image

3. **Item**: A physical or digital copy owned by a household
   - References: one Work (required) and optionally one Edition
   - Contains: barcode, location, status, condition, notes
   - Has: tags, acquisition details

## API Endpoints Updated

- ✅ POST `/api/households/{householdId}/library/books` - Create book (already working)
- ✅ GET `/api/households/{householdId}/items` - Get items (now properly mapped)
- ✅ GET `/api/items/{itemId}` - Get single item (typed)
- ✅ GET `/api/works/{workId}` - Get work details (new function)
- ✅ GET `/api/editions/{editionId}` - Get edition details (new function)
- ✅ GET `/api/editions/{editionId}/cover` - Get cover image (URL helper added)

## Testing Checklist

- [ ] Verify books added via AddBookPage appear in LibraryPage
- [ ] Check that titles and authors display correctly
- [ ] Verify ISBN-10 and ISBN-13 are extracted properly
- [ ] Test cover images load (if available)
- [ ] Verify publisher and publication year display
- [ ] Check page count displays correctly
- [ ] Test search functionality with new mapping
- [ ] Verify household switching still works correctly

## Next Steps

1. Test the library display with existing books in the database
2. Verify cover images load correctly
3. Consider implementing cover upload functionality
4. Add support for filtering by ItemKind (currently all items shown)
5. Implement tags display and filtering
6. Add subject/classification display
