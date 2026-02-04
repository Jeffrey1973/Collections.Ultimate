# Frontend Book Fields Reference

Complete documentation of all book fields in the frontend application for backend database schema implementation.

## Field Count Summary
- **Total Fields**: ~180 fields across 19 categories
- **Core Fields**: 7 required fields
- **Optional Fields**: ~173 optional fields
- **Array Fields**: ~25 fields that store multiple values
- **Custom Fields**: Unlimited user-defined fields

---

## Database Schema Recommendations

### Work Table (Abstract Intellectual Work)
Store conceptual work information - fields that apply to all editions of a work.

### Edition Table (Specific Published Version)
Store publication-specific information - fields that vary by edition.

### Item Table (Physical/Digital Copy)
Store instance-specific information - fields unique to each copy owned.

### Metadata JSONB Column
For flexible storage of:
- Historical & theological fields
- National library identifiers
- Extended metadata that doesn't fit structured schema
- Custom user fields

---

## Field Categories and Definitions

### 1. BASIC INFORMATION (7 fields)
**Location**: Work + Edition tables

| Field | Type | Required | Storage Location | Description |
|-------|------|----------|------------------|-------------|
| `id` | string | Yes | Item.itemId | Unique identifier |
| `householdId` | string | Yes | Item.householdId | Household/library owner |
| `title` | string | Yes | Work.title | Book title |
| `author` | string | Yes | Work (via contributors) | Primary author(s) |
| `subtitle` | string | No | Work.subtitle | Subtitle |
| `originalTitle` | string | No | Work or JSONB | Original language title |
| `description` | string/textarea | No | Work.description | Book description/summary |
| `coverImageUrl` | url | No | Edition.coverImageId | Cover image URL/reference |
| `publisher` | string | No | Edition.publisher | Publisher name |
| `publishedDate` | string | No | Edition.publishedYear | Publication date |
| `pageCount` | number | No | Edition.pageCount | Number of pages |
| `language` | string | No | Edition or JSONB | ISO language code (e.g., 'en') |
| `dateAdded` | string | Yes | Item.createdOn | Date added to library |

---

### 2. HISTORICAL & THEOLOGICAL (3 fields) ⭐ NEW
**Location**: JSONB metadata column

| Field | Type | Storage | Description |
|-------|------|---------|-------------|
| `churchHistoryPeriod` | string | JSONB | Church history period (Apostolic, Ante-Nicene, Nicene, Post-Nicene, Medieval, Reformation, Enlightenment) |
| `dateWritten` | string | JSONB | Original composition date (may differ from publication date) |
| `religiousTradition` | array | JSONB | Religious tradition(s) - Catholic, Eastern Orthodox, Protestant, Baptist, Reformed, etc. (can be multiple) |

---

### 3. IDENTIFIERS (16 fields)
**Location**: Edition.identifiers table (foreign key relationship)

| Field | Type | IdentifierTypeId | Description |
|-------|------|------------------|-------------|
| `isbn` | string | 1 or 2 | General ISBN (10 or 13 digit) |
| `isbn10` | string | 1 | 10-digit ISBN |
| `isbn13` | string | 2 | 13-digit ISBN |
| `issn` | string | ? | International Standard Serial Number (for periodicals) |
| `lccn` | string | ? | Library of Congress Control Number |
| `oclcNumber` | string | ? | WorldCat/OCLC identifier |
| `oclcWorkId` | string | ? | OCLC Work-level identifier |
| `doi` | string | ? | Digital Object Identifier (academic works) |
| `asin` | string | ? | Amazon Standard Identification Number |
| `googleBooksId` | string | ? | Google Books unique ID |
| `goodreadsId` | string | ? | Goodreads work/book ID |
| `libraryThingId` | string | ? | LibraryThing work ID |
| `olid` | string | ? | Open Library ID |
| `dnbId` | string | ? | Deutsche Nationalbibliothek ID (German) |
| `bnfId` | string | ? | Bibliothèque nationale de France ID |
| `nlaId` | string | ? | National Library of Australia ID |
| `ndlId` | string | ? | National Diet Library ID (Japan) |
| `lacId` | string | ? | Library and Archives Canada ID |
| `blId` | string | ? | British Library ID |

**Recommendation**: Expand IdentifierType enum in backend to include all these types.

---

### 4. CLASSIFICATION & CATEGORIES (11 fields)
**Location**: Work table + Edition.subjects table + JSONB

| Field | Type | Storage | Description |
|-------|------|---------|-------------|
| `mainCategory` | string | JSONB | Primary category |
| `categories` | array | Tags table | Google Books categories |
| `subjects` | array | Subjects table | Subject headings |
| `deweyDecimal` | string | JSONB | Dewey Decimal Classification |
| `deweyEdition` | string | JSONB | Edition of Dewey system used |
| `lcc` | string | JSONB | Library of Congress Classification |
| `lccEdition` | string | JSONB | Edition of LC system used |
| `callNumber` | string | JSONB | Library call number |
| `bisacCodes` | array | JSONB | Book Industry Standards codes |
| `thema` | array | JSONB | International subject codes |
| `fastSubjects` | array | JSONB | FAST subject headings |

---

### 5. PUBLICATION DETAILS (8 fields)
**Location**: Edition table + JSONB

| Field | Type | Storage | Description |
|-------|------|---------|-------------|
| `publisher` | string | Edition.publisher | Publisher name |
| `publishedDate` | string | Edition.publishedYear | Publication date |
| `edition` | string | JSONB | Edition statement (e.g., "2nd ed.") |
| `editionStatement` | string | JSONB | Detailed edition information |
| `printType` | string | JSONB | "BOOK" or "MAGAZINE" |
| `format` | string | JSONB | Hardcover, Paperback, eBook, Audiobook |
| `placeOfPublication` | string | JSONB | City/country of publication |
| `originalPublicationDate` | string | JSONB | First edition date |
| `copyright` | string | JSONB | Copyright year/statement |
| `printingHistory` | string | JSONB | Printing details |

---

### 6. CONTRIBUTORS (7 fields)
**Location**: Work.contributors table (foreign key relationship)

| Field | Type | Storage | Description |
|-------|------|---------|-------------|
| `author` | string | Contributors (roleId=1) | Primary author(s) - comma separated |
| `translator` | string | Contributors (roleId=?) | Translator name |
| `illustrator` | string | Contributors (roleId=?) | Illustrator name |
| `editor` | string | Contributors (roleId=?) | Editor name |
| `narrator` | string | Contributors (roleId=?) | Narrator for audiobooks |
| `contributors` | array | Contributors table | Detailed contributor array with roles |

**Contributors Array Structure**:
```typescript
{
  name: string
  role: string  // "author", "editor", "translator", "illustrator", "narrator"
  ordinal: number // Sort order
}
```

---

### 7. PHYSICAL DETAILS (10 fields)
**Location**: JSONB metadata

| Field | Type | Description |
|-------|------|-------------|
| `dimensions` | string | Formatted dimension string (e.g., "8.5 x 11 x 1.2 inches") |
| `dimensionsHeight` | string | Height measurement |
| `dimensionsWidth` | string | Width measurement |
| `dimensionsThickness` | string | Thickness/depth measurement |
| `weight` | string | Weight |
| `shippingWeight` | string | Shipping weight (may differ from actual) |
| `binding` | string | Hardcover, Paperback, Mass Market, Library Binding |
| `pagination` | string | Detailed page info (e.g., "viii, 342 p.") |
| `physicalDescription` | string | Complete physical description |
| `numberOfVolumes` | number | Number of volumes in set |

---

### 8. CONTENT & READING (9 fields)
**Location**: Work table + JSONB

| Field | Type | Storage | Description |
|-------|------|---------|-------------|
| `description` | textarea | Work.description | Full description |
| `tableOfContents` | textarea | JSONB | Table of contents |
| `firstSentence` | string | JSONB | Opening sentence |
| `excerpt` | textarea | JSONB | Excerpt or sample text |
| `textSnippet` | string | JSONB | Search result snippet |
| `readingAge` | string | JSONB | Recommended age range |
| `lexileScore` | string | JSONB | Lexile reading level |
| `arLevel` | string | JSONB | Accelerated Reader level |
| `maturityRating` | string | JSONB | Content rating |

---

### 9. SERIES INFORMATION (4 fields)
**Location**: JSONB metadata (future: Series table)

| Field | Type | Description |
|-------|------|-------------|
| `series` | string | Series name (legacy) |
| `seriesInfo` | json | Structured series data (seriesId, seriesName, volumeNumber) |
| `volumeNumber` | string | Volume number in series |
| `numberOfVolumes` | number | Total volumes in series |

---

### 10. RATINGS & REVIEWS (7 fields)
**Location**: JSONB metadata

| Field | Type | Description |
|-------|------|-------------|
| `averageRating` | number | Average rating (0-5 scale) |
| `ratingsCount` | number | Number of ratings |
| `reviewsCount` | number | Total number of reviews |
| `reviewsTextCount` | number | Number of text reviews (vs just ratings) |
| `fiveStarPercent` | number | Percentage of 5-star reviews |
| `communityRating` | number | Community/Goodreads rating |

---

### 11. IMAGES (7 fields)
**Location**: Edition.coverImageId + JSONB for alternate sizes

| Field | Type | Description |
|-------|------|-------------|
| `coverImageUrl` | url | Primary cover image URL |
| `coverImageSmallThumbnail` | url | Tiny thumbnail |
| `coverImageThumbnail` | url | Small thumbnail |
| `coverImageSmall` | url | Small image |
| `coverImageMedium` | url | Medium image |
| `coverImageLarge` | url | Large image |
| `coverImageExtraLarge` | url | Extra large image |

---

### 12. ACCESS & AVAILABILITY (8 fields)
**Location**: JSONB metadata

| Field | Type | Description |
|-------|------|-------------|
| `readingModesText` | boolean | Text reading available |
| `readingModesImage` | boolean | Image/scan reading available |
| `allowAnonLogging` | boolean | Anonymous logging allowed |
| `availability` | string | "In stock", "Out of stock", etc. |
| `librariesOwning` | number | Number of libraries owning (WorldCat) |
| `nearbyLibraries` | array | Nearby libraries with copy |

---

### 13. SALE INFORMATION (10 fields)
**Location**: JSONB metadata

| Field | Type | Description |
|-------|------|-------------|
| `saleCountry` | string | Country where sale info applies |
| `saleability` | string | "FOR_SALE", "NOT_FOR_SALE", "FREE" |
| `onSaleDate` | string | Date book went on sale |
| `isEbook` | boolean | Is this an ebook? |
| `listPriceAmount` | number | List price amount |
| `listPriceCurrency` | string | Currency code (USD, EUR, etc.) |
| `retailPriceAmount` | number | Retail/selling price |
| `retailPriceCurrency` | string | Retail price currency |
| `buyLink` | url | Purchase link |
| `currentPrice` | number | Current price |

---

### 14. COMMERCIAL (6 fields)
**Location**: JSONB metadata

| Field | Type | Description |
|-------|------|-------------|
| `currentPrice` | number | Current market price |
| `discount` | number | Discount percentage |
| `usedPrices` | array | Array of used book prices |
| `bestsellerRank` | number | Amazon/bestseller ranking |
| `salesRank` | number | Overall sales ranking |

---

### 15. COMMUNITY DATA (3 fields)
**Location**: JSONB metadata

| Field | Type | Description |
|-------|------|-------------|
| `communityRating` | number | Community/Goodreads rating |
| `popularShelves` | array | Popular shelves/tags from community |
| `readingChallenge` | string | Reading challenge participation |

---

### 16. LINKS & REFERENCES (4 fields)
**Location**: JSONB metadata

| Field | Type | Description |
|-------|------|-------------|
| `selfLink` | url | API self-reference link |
| `canonicalVolumeLink` | url | Canonical volume URL |
| `buyLink` | url | Purchase link |
| `previewLink` | url | Preview/sample link |

---

### 17. USER-SPECIFIC (5 fields)
**Location**: Item table

| Field | Type | Storage | Description |
|-------|------|---------|-------------|
| `location` | string | Item.location | Physical location/shelf |
| `status` | string | Item.status | "owned", "wishlist", "borrowed", etc. |
| `condition` | string | Item.condition | Physical condition |
| `notes` | textarea | Item.notes | User notes |
| `dateAdded` | string | Item.createdOn | Date added to library |

---

### 18. METADATA & SYSTEM (7 fields)
**Location**: System fields

| Field | Type | Storage | Description |
|-------|------|---------|-------------|
| `etag` | string | JSONB | Entity tag for caching |
| `contentVersion` | string | JSONB | Content version identifier |
| `subtitleLanguage` | string | JSONB | Subtitle language |
| `otherTitles` | array | JSONB | Alternate titles |
| `translatedFrom` | string | JSONB | Original language |

---

### 19. CUSTOM FIELDS (unlimited)
**Location**: JSONB metadata column

| Field | Type | Description |
|-------|------|-------------|
| `customFields` | json | User-defined custom fields - any key-value pairs |

**Example Structure**:
```json
{
  "customFields": {
    "acquired_from": "Estate sale",
    "first_edition": true,
    "signed": false,
    "reading_status": "To Read",
    "personal_rating": 5
  }
}
```

---

## Recommended Backend Schema Changes

### 1. Add JSONB Metadata Column
```sql
-- To Work table
ALTER TABLE works ADD COLUMN metadata JSONB;

-- To Edition table  
ALTER TABLE editions ADD COLUMN metadata JSONB;

-- To Item table
ALTER TABLE items ADD COLUMN metadata JSONB;
```

### 2. Field Distribution Strategy

**Work Table (Conceptual)**:
- title, subtitle, originalTitle, description
- JSONB: categories, subjects, classification data, historical/theological fields

**Edition Table (Publication-specific)**:
- publisher, publishedYear, pageCount, format, binding
- identifiers (foreign key table)
- JSONB: dimensions, physical details, publication details

**Item Table (Instance-specific)**:
- barcode, location, status, condition, notes
- householdId, acquisitionDate, price
- JSONB: user fields, custom fields

### 3. Expand Identifier Types
Add to IdentifierType enum:
- ISBN-10 (1)
- ISBN-13 (2)
- ISSN
- LCCN
- OCLC Number
- DOI
- ASIN
- Google Books ID
- Goodreads ID
- Open Library ID
- DNB ID (German National Library)
- BNF ID (French National Library)
- NLA ID (Australian National Library)
- NDL ID (Japanese National Library)
- LAC ID (Library Archives Canada)
- BL ID (British Library)

### 4. Expand Contributor Roles
Add to ContributorRole enum:
- Author (1)
- Editor (2)
- Translator (3)
- Illustrator (4)
- Narrator (5)
- Introduction (6)
- Foreword (7)
- Afterword (8)
- Photographer (9)
- Designer (10)

### 5. Subjects and Classification
Keep existing Subjects table but consider:
- Add SubjectScheme enum values for different classification systems
- Store Dewey/LCC in JSONB for flexibility
- Support multiple classification schemes per work

---

## API Endpoint Updates Needed

### POST /api/households/{id}/library/books
**Expand CreateBookIngestRequest to accept**:
- `metadata` field for JSONB data
- Historical & theological fields
- All classification fields
- Extended contributor information

### GET /api/items/{id}
**Return expanded ItemResponse with**:
- All metadata fields from JSONB
- All identifiers
- All contributors with roles
- All subjects/tags

### PUT/PATCH /api/items/{id}
**Allow updating**:
- Metadata JSONB fields
- Custom fields
- All editable fields

---

## Migration Strategy

### Phase 1: Add JSONB Column
- Add metadata JSONB column to Work, Edition, Item tables
- Deploy backend changes
- Frontend sends all non-structured fields in metadata

### Phase 2: Expand Enums
- Add new IdentifierType values
- Add new ContributorRole values
- Add new SubjectScheme values

### Phase 3: Historical Fields
- Frontend sends Historical & Theological fields in metadata
- Create indexes on frequently queried JSONB fields

### Phase 4: Migration Tool
- Create migration script to move existing notes to structured metadata
- Validate data integrity

---

## Example API Payload

```json
{
  "work": {
    "title": "The Imitation of Christ",
    "subtitle": "A Timeless Classic for Contemporary Readers",
    "description": "The Imitation of Christ by Thomas à Kempis...",
    "metadata": {
      "originalTitle": "De Imitatione Christi",
      "churchHistoryPeriod": "Medieval",
      "dateWritten": "c. 1418-1427",
      "religiousTradition": ["Catholic", "Devotio Moderna"],
      "deweyDecimal": "242.2",
      "lcc": "BV4821"
    }
  },
  "edition": {
    "publisher": "Image Books",
    "publishedYear": 2004,
    "pageCount": 272,
    "identifiers": [
      { "identifierTypeId": 2, "value": "9780385436953", "isPrimary": true }
    ],
    "metadata": {
      "format": "Paperback",
      "binding": "Trade Paperback",
      "dimensions": "5.2 x 0.6 x 8 inches"
    }
  },
  "item": {
    "title": "The Imitation of Christ",
    "notes": "Personal devotional copy",
    "metadata": {
      "customFields": {
        "translation": "William C. Creasy",
        "reading_status": "Currently Reading",
        "personal_rating": 5
      }
    }
  },
  "contributors": [
    {
      "displayName": "Thomas à Kempis",
      "roleId": 1,
      "ordinal": 1,
      "sortName": "Kempis, Thomas à"
    },
    {
      "displayName": "William C. Creasy",
      "roleId": 3,
      "ordinal": 2,
      "sortName": "Creasy, William C."
    }
  ],
  "tags": ["devotional", "medieval", "spiritual formation"],
  "subjects": [
    { "schemeId": 1, "text": "Spiritual life--Catholic Church" },
    { "schemeId": 1, "text": "Devotional literature" }
  ]
}
```

---

## Frontend-Backend Field Mapping

This table shows how frontend Book fields map to backend schema:

| Frontend Field | Backend Location | Notes |
|----------------|------------------|-------|
| Basic fields | Work/Edition tables | Direct mapping |
| Historical/Theological | Work.metadata JSONB | New fields |
| Identifiers | Edition.identifiers table | Expand enum |
| Classification | Work.metadata JSONB | Flexible storage |
| Contributors | Work.contributors table | Expand roles |
| Physical details | Edition.metadata JSONB | Structured in JSONB |
| Custom fields | Item.metadata JSONB | User-defined |

---

## Total Storage Requirements

**Structured Tables**: ~30-40 fields per book
**JSONB Metadata**: ~140-150 optional fields
**Custom Fields**: Unlimited

This approach balances structured data for efficient querying with flexible JSONB storage for extended metadata.
