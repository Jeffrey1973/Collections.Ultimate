# Extended Book Schema - Implementation Summary

This document summarizes the schema changes made to support the ~180 book fields from the frontend form.

## Database Migration

**File:** `api\Db\migrations\0014_extended_book_schema.sql`

Run this migration to add all the new fields and tables.

### Changes Made:

#### Work Table
- `OriginalTitle` (nvarchar(512)) - Original language title for translations
- `Language` (nvarchar(10)) - ISO 639-1 language code
- `MetadataJson` (nvarchar(max)) - Flexible JSON storage for extended metadata

#### Edition Table
- `Format` (nvarchar(50)) - Hardcover, Paperback, eBook, Audiobook
- `Binding` (nvarchar(50)) - Hardcover, Paperback, Mass Market, Library Binding
- `EditionStatement` (nvarchar(256)) - Edition text (e.g., "2nd ed.")
- `PlaceOfPublication` (nvarchar(200)) - City/country of publication
- `Language` (nvarchar(10)) - Edition-specific language
- `MetadataJson` (nvarchar(max)) - Flexible JSON storage

#### New Tables
- `Series` - Track book series
- `WorkSeries` - Link works to series with volume numbers
- `EditionImages` - Multiple cover image sizes

#### Expanded Enums
- **IdentifierTypes**: Added ISSN, OCLC, DOI, GoogleBooks, Goodreads, LibraryThing, OpenLibrary, DNB, BNF, NLA, NDL, LAC, BL (IDs 7-20)
- **ContributorRoles**: Added Narrator, Introduction, Foreword, Afterword, Photographer, Designer, Contributor (IDs 5-11)
- **SubjectSchemes**: Added DDC, LCC, BISAC, Thema, FAST (IDs 3-7)

## API Response: GET /api/items/{itemId}

The `GET /api/items/{itemId}` endpoint now returns a **full nested structure** with Work, Edition, Contributors, Tags, Subjects, Identifiers, and Series.

### ItemFullResponse Structure
```json
{
  "itemId": "guid",
  "householdId": "guid",
  "kind": 1,
  "title": "The Imitation of Christ",
  "subtitle": "A Timeless Classic",
  "notes": "My personal copy",
  "barcode": "12345",
  "location": "Shelf A",
  "status": "owned",
  "condition": "good",
  "acquiredOn": "2024-01-15",
  "price": 15.99,
  "metadataJson": "{\"customFields\": {\"signed\": true}}",
  "createdUtc": "2024-01-15T10:30:00Z",
  
  "work": {
    "workId": "guid",
    "title": "The Imitation of Christ",
    "subtitle": "A Timeless Classic",
    "sortTitle": "Imitation of Christ",
    "description": "A devotional classic...",
    "originalTitle": "De Imitatione Christi",
    "language": "la",
    "metadataJson": "{\"churchHistoryPeriod\": \"Medieval\", \"dateWritten\": \"c. 1418\"}",
    "createdUtc": "2024-01-15T10:30:00Z"
  },
  
  "edition": {
    "editionId": "guid",
    "editionTitle": null,
    "editionSubtitle": null,
    "publisher": "Image Books",
    "publishedYear": 2004,
    "pageCount": 272,
    "description": null,
    "coverImageUrl": "https://...",
    "format": "Paperback",
    "binding": "Trade Paperback",
    "editionStatement": "Revised edition",
    "placeOfPublication": "New York",
    "language": "en",
    "metadataJson": "{\"dimensions\": \"5.2 x 0.6 x 8 inches\"}",
    "createdUtc": "2024-01-15T10:30:00Z"
  },
  
  "contributors": [
    {
      "personId": "guid",
      "displayName": "Thomas à Kempis",
      "sortName": "Kempis, Thomas à",
      "roleId": 1,
      "roleName": "Author",
      "ordinal": 1,
      "birthYear": 1380,
      "deathYear": 1471
    },
    {
      "personId": "guid",
      "displayName": "William C. Creasy",
      "sortName": "Creasy, William C.",
      "roleId": 3,
      "roleName": "Translator",
      "ordinal": 1,
      "birthYear": null,
      "deathYear": null
    }
  ],
  
  "tags": [
    { "tagId": "guid", "name": "devotional" },
    { "tagId": "guid", "name": "medieval" }
  ],
  
  "subjects": [
    {
      "subjectHeadingId": "guid",
      "schemeId": 2,
      "schemeName": "LCSH",
      "text": "Spiritual life--Catholic Church"
    }
  ],
  
  "identifiers": [
    {
      "identifierTypeId": 2,
      "identifierTypeName": "ISBN13",
      "value": "9780385436953",
      "isPrimary": true
    }
  ],
  
  "series": {
    "seriesId": "guid",
    "name": "Image Classics",
    "volumeNumber": "12",
    "ordinal": 12
  }
}
```

## API Changes

### Updated DTOs

#### CreateWorkRequest
```json
{
  "title": "string (required)",
  "subtitle": "string?",
  "sortTitle": "string?",
  "description": "string?",
  "originalTitle": "string?",
  "language": "string?",
  "metadataJson": "string?"
}
```

#### CreateEditionRequest
```json
{
  "editionTitle": "string?",
  "editionSubtitle": "string?",
  "publisher": "string?",
  "publishedYear": "int?",
  "pageCount": "int?",
  "description": "string?",
  "format": "string?",
  "binding": "string?",
  "editionStatement": "string?",
  "placeOfPublication": "string?",
  "language": "string?",
  "metadataJson": "string?"
}
```

#### CreateBookIngestRequest (One-shot endpoint)
```json
{
  "work": {
    "title": "string (required)",
    "subtitle": "string?",
    "sortTitle": "string?",
    "description": "string?",
    "originalTitle": "string?",
    "language": "string?",
    "metadataJson": "string?"
  },
  "item": {
    "title": "string?",
    "subtitle": "string?",
    "notes": "string?",
    "barcode": "string?",
    "location": "string?",
    "status": "string?",
    "condition": "string?",
    "acquiredOn": "date?",
    "price": "decimal?",
    "metadataJson": "string?"
  },
  "edition": {
    "editionTitle": "string?",
    "editionSubtitle": "string?",
    "publisher": "string?",
    "publishedYear": "int?",
    "pageCount": "int?",
    "description": "string?",
    "format": "string?",
    "binding": "string?",
    "editionStatement": "string?",
    "placeOfPublication": "string?",
    "language": "string?",
    "metadataJson": "string?",
    "identifiers": [
      { "identifierTypeId": 1, "value": "0123456789", "isPrimary": true }
    ]
  },
  "contributors": [
    { "displayName": "John Doe", "roleId": 1, "ordinal": 1 }
  ],
  "tags": ["fiction", "classic"],
  "subjects": [
    { "schemeId": 1, "text": "Fiction" }
  ],
  "series": {
    "name": "The Lord of the Rings",
    "volumeNumber": "1",
    "ordinal": 1
  }
}
```

## MetadataJson Field Structure

Use the `metadataJson` fields to store additional optional fields as JSON:

### Work.MetadataJson Example
```json
{
  "churchHistoryPeriod": "Medieval",
  "dateWritten": "c. 1418-1427",
  "religiousTradition": ["Catholic", "Devotio Moderna"],
  "deweyDecimal": "242.2",
  "deweyEdition": "23",
  "lcc": "BV4821",
  "lccEdition": "2023",
  "mainCategory": "Religion",
  "bisacCodes": ["REL012000", "REL067000"],
  "thema": ["QRVC1"],
  "fastSubjects": ["Spiritual life", "Devotional literature"]
}
```

### Edition.MetadataJson Example
```json
{
  "dimensions": "5.2 x 0.6 x 8 inches",
  "dimensionsHeight": "8",
  "dimensionsWidth": "5.2",
  "dimensionsThickness": "0.6",
  "weight": "8.8 oz",
  "pagination": "viii, 342 p.",
  "physicalDescription": "Trade paperback with flaps",
  "numberOfVolumes": 1,
  "copyright": "2004",
  "printingHistory": "First printing 2004",
  "originalPublicationDate": "1418",
  "coverImages": {
    "thumbnail": "https://...",
    "small": "https://...",
    "medium": "https://...",
    "large": "https://..."
  },
  "tableOfContents": "Introduction...",
  "firstSentence": "He who follows Me...",
  "readingAge": "18+",
  "lexileScore": "1200L",
  "maturityRating": "NOT_MATURE"
}
```

### Item.MetadataJson Example
```json
{
  "customFields": {
    "acquired_from": "Estate sale",
    "first_edition": true,
    "signed": false,
    "reading_status": "To Read",
    "personal_rating": 5
  },
  "averageRating": 4.5,
  "ratingsCount": 12500,
  "communityRating": 4.3
}
```

## Identifier Type IDs

| ID | Name | Description |
|----|------|-------------|
| 1 | ISBN10 | 10-digit ISBN |
| 2 | ISBN13 | 13-digit ISBN |
| 3 | ASIN | Amazon Standard ID |
| 4 | LCCN | Library of Congress Control Number |
| 5 | EAN | European Article Number |
| 6 | UPC | Universal Product Code |
| 7 | ISSN | International Standard Serial Number |
| 8 | OCLC | WorldCat/OCLC ID |
| 9 | OCLCWork | OCLC Work-level ID |
| 10 | DOI | Digital Object Identifier |
| 11 | GoogleBooks | Google Books ID |
| 12 | Goodreads | Goodreads ID |
| 13 | LibraryThing | LibraryThing ID |
| 14 | OpenLibrary | Open Library ID |
| 15 | DNB | German National Library |
| 16 | BNF | French National Library |
| 17 | NLA | Australian National Library |
| 18 | NDL | Japanese National Diet Library |
| 19 | LAC | Library and Archives Canada |
| 20 | BL | British Library |

## Contributor Role IDs

| ID | Name |
|----|------|
| 1 | Author |
| 2 | Editor |
| 3 | Translator |
| 4 | Illustrator |
| 5 | Narrator |
| 6 | Introduction |
| 7 | Foreword |
| 8 | Afterword |
| 9 | Photographer |
| 10 | Designer |
| 11 | Contributor |

## Subject Scheme IDs

| ID | Name | Description |
|----|------|-------------|
| 1 | Local | User-defined subjects |
| 2 | LCSH | Library of Congress Subject Headings |
| 3 | DDC | Dewey Decimal Classification |
| 4 | LCC | Library of Congress Classification |
| 5 | BISAC | Book Industry Standards |
| 6 | Thema | International subject codes |
| 7 | FAST | Faceted Application of Subject Terminology |

## Frontend Integration

When sending data from the frontend, use this strategy:

1. **Structured fields** go in their dedicated properties (title, author, isbn, etc.)
2. **Extended/flexible fields** go in `metadataJson` as a JSON string
3. **Series info** uses the new `series` property
4. **Multiple identifiers** use the `identifiers` array with appropriate `identifierTypeId`

Example frontend code:
```typescript
const bookData = {
  work: {
    title: formData.title,
    subtitle: formData.subtitle,
    description: formData.description,
    originalTitle: formData.originalTitle,
    language: formData.language,
    metadataJson: JSON.stringify({
      churchHistoryPeriod: formData.churchHistoryPeriod,
      dateWritten: formData.dateWritten,
      religiousTradition: formData.religiousTradition,
      deweyDecimal: formData.deweyDecimal,
      lcc: formData.lcc
    })
  },
  edition: {
    publisher: formData.publisher,
    publishedYear: formData.publishedYear,
    pageCount: formData.pageCount,
    format: formData.format,
    binding: formData.binding,
    metadataJson: JSON.stringify({
      dimensions: formData.dimensions,
      weight: formData.weight
    }),
    identifiers: [
      { identifierTypeId: 2, value: formData.isbn13, isPrimary: true }
    ]
  },
  // ... rest of the data
};

await fetch(`/api/households/${householdId}/library/books`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(bookData)
});
```
