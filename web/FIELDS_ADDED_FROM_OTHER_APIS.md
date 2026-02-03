# Fields Added from Other APIs

## Summary

Added **40+ new fields** to the Book interface that are available from APIs other than Google Books.

## New Fields by Category

### 📑 Classification & Cataloging (3 fields)
- `deweyEdition` - Edition of Dewey Decimal system used
- `lccEdition` - Edition of Library of Congress Classification system used
- `fastSubjects[]` - FAST (Faceted Application of Subject Terminology) subjects

**Source APIs:** OCLC Classify, Library of Congress

### 🔖 National Library Identifiers (6 fields)
- `dnbId` - Deutsche Nationalbibliothek (German National Library)
- `bnfId` - Bibliothèque nationale de France (French National Library)
- `nlaId` - National Library of Australia
- `ndlId` - National Diet Library (Japan)
- `lacId` - Library and Archives Canada
- `blId` - British Library

**Source APIs:** Each national library's API

### 📏 Physical Details (3 fields)
- `shippingWeight` - Weight for shipping calculations
- `binding` - Specific binding type (Hardcover, Paperback, Mass Market, etc.)
- `pagination` - Detailed page information (e.g., "viii, 342 p.")

**Source APIs:** Amazon, ISBNdb, Open Library

### 📖 Enhanced Content (8 fields)
- `byStatement` - Attribution statement (e.g., "by Jane Austen ; edited by R.W. Chapman")
- `bibliography` - Bibliography notes (e.g., "Includes bibliographical references and index")
- `colophon` - Publishing and printing details
- `printRun` - Print run information (e.g., "First printing: 5000 copies")
- `originalLanguage` - Original language if translated
- `quotes[]` - Memorable quotes from the book
- `trivia[]` - Interesting facts about the book
- `similarBooks[]` - Related/similar book ISBNs or IDs

**Source APIs:** Library of Congress, Open Library, Goodreads

### ✍️ Contributors (1 field - enhanced)
- `contributors[]` - Detailed contributor information with roles
  ```typescript
  {
    name: string
    role: string // "author", "editor", "translator", "illustrator", etc.
    ordinal?: number
  }
  ```

**Source APIs:** Open Library, BookBrainz

### ⭐ Ratings & Reviews (3 fields)
- `reviewsTextCount` - Number of text reviews (vs just star ratings)
- `fiveStarPercent` - Percentage of 5-star reviews
- `communityRating` - Rating from community sources (Goodreads, etc.)

**Source APIs:** Amazon, Goodreads, LibraryThing

### 💰 Commercial & Availability (6 fields)
- `currentPrice` - Current market price
- `discount` - Discount percentage off list price
- `usedPrices[]` - Array of used book prices from various sellers
- `availability` - Stock status ("In stock", "Out of stock", etc.)
- `bestsellerRank` - Amazon bestseller rank or similar
- `librariesOwning` - Number of libraries that own this book (from WorldCat)

**Source APIs:** Amazon, Barnes & Noble, AbeBooks, WorldCat

### 📚 Library Availability (1 field)
- `nearbyLibraries[]` - Nearby libraries that own the book
  ```typescript
  {
    name: string
    distance: string
  }
  ```

**Source APIs:** WorldCat

### 👥 Community Metadata (2 fields)
- `popularShelves[]` - Popular Goodreads shelves this book appears on
- `similarBooks[]` - ISBNs or IDs of similar/related books

**Source APIs:** Goodreads, LibraryThing

## Total Count

| Category | New Fields |
|----------|-----------|
| Classification | 3 |
| National IDs | 6 |
| Physical | 3 |
| Content | 8 |
| Contributors | 1 (enhanced) |
| Ratings | 3 |
| Commercial | 6 |
| Availability | 1 |
| Community | 2 |
| **TOTAL** | **33+ fields** |

Plus the enhanced `contributors` array structure for better role tracking.

## Field Config Updates Needed

To make these fields appear in the form, we need to add them to `field-config.ts`:

### Add to Classification Category
```typescript
{
  key: 'deweyEdition',
  label: 'Dewey Edition',
  type: 'text',
  category: 'classification',
  source: 'oclc',
},
{
  key: 'lccEdition',
  label: 'LC Edition',
  type: 'text',
  category: 'classification',
  source: 'oclc',
},
{
  key: 'fastSubjects',
  label: 'FAST Subjects',
  type: 'array',
  category: 'classification',
  source: 'oclc',
},
```

### Add to Identifiers Category
```typescript
{
  key: 'dnbId',
  label: 'DNB ID (German National Library)',
  type: 'text',
  category: 'identifiers',
},
{
  key: 'bnfId',
  label: 'BNF ID (French National Library)',
  type: 'text',
  category: 'identifiers',
},
// ... etc for other national libraries
```

### Add to Physical Category
```typescript
{
  key: 'binding',
  label: 'Binding Type',
  type: 'text',
  category: 'physical',
  placeholder: 'Hardcover, Paperback, Mass Market, etc.',
},
{
  key: 'shippingWeight',
  label: 'Shipping Weight',
  type: 'text',
  category: 'physical',
},
{
  key: 'pagination',
  label: 'Pagination',
  type: 'text',
  category: 'physical',
  placeholder: 'e.g., viii, 342 p.',
},
```

### Add to Content Category
```typescript
{
  key: 'byStatement',
  label: 'By Statement',
  type: 'text',
  category: 'content',
  description: 'Attribution statement',
},
{
  key: 'bibliography',
  label: 'Bibliography',
  type: 'text',
  category: 'content',
},
{
  key: 'colophon',
  label: 'Colophon',
  type: 'textarea',
  category: 'content',
},
{
  key: 'printRun',
  label: 'Print Run',
  type: 'text',
  category: 'content',
},
{
  key: 'originalLanguage',
  label: 'Original Language',
  type: 'text',
  category: 'content',
},
{
  key: 'quotes',
  label: 'Memorable Quotes',
  type: 'array',
  category: 'content',
},
{
  key: 'trivia',
  label: 'Trivia',
  type: 'array',
  category: 'content',
},
```

### Add New Category: "Commercial & Availability"
```typescript
{
  key: 'commercial',
  label: 'Commercial & Availability',
  icon: '🏪',
  description: 'Pricing, availability, and library holdings',
},
```

With fields:
```typescript
{
  key: 'currentPrice',
  label: 'Current Price',
  type: 'number',
  category: 'commercial',
},
{
  key: 'discount',
  label: 'Discount %',
  type: 'number',
  category: 'commercial',
},
{
  key: 'availability',
  label: 'Availability Status',
  type: 'text',
  category: 'commercial',
},
{
  key: 'bestsellerRank',
  label: 'Bestseller Rank',
  type: 'number',
  category: 'commercial',
},
{
  key: 'librariesOwning',
  label: 'Libraries Owning',
  type: 'number',
  category: 'commercial',
  description: 'Number of libraries that own this book (WorldCat)',
},
```

### Add New Category: "Community"
```typescript
{
  key: 'community',
  label: 'Community Data',
  icon: '👥',
  description: 'Goodreads, LibraryThing, and community metadata',
},
```

With fields:
```typescript
{
  key: 'communityRating',
  label: 'Community Rating',
  type: 'number',
  category: 'community',
},
{
  key: 'reviewsTextCount',
  label: 'Text Reviews Count',
  type: 'number',
  category: 'community',
},
{
  key: 'fiveStarPercent',
  label: '5-Star Reviews %',
  type: 'number',
  category: 'community',
},
{
  key: 'popularShelves',
  label: 'Popular Shelves',
  type: 'array',
  category: 'community',
  description: 'Popular Goodreads shelves',
},
{
  key: 'similarBooks',
  label: 'Similar Books',
  type: 'array',
  category: 'community',
},
```

## API Integration Priorities

To actually populate these fields, enhance these API integrations:

### Priority 1: OCLC Classify
- `deweyDecimal`, `deweyEdition`
- `lcc`, `lccEdition`
- `fastSubjects`
- `oclcWorkId`

**Action:** Update `lookupFromOCLCClassify()` to extract these fields.

### Priority 2: Library of Congress
- `lccn`
- `tableOfContents`
- `bibliography`
- `byStatement`

**Action:** Update `lookupFromLibraryOfCongress()` to extract these fields.

### Priority 3: Open Library
- `olid`
- `awards`
- `firstSentence`
- `contributors` (with roles)
- `placeOfPublication`
- `byStatement`
- `pagination`
- `weight`

**Action:** Update `lookupFromOpenLibrary()` to extract these fields.

### Priority 4: WorldCat
- `oclcNumber`
- `librariesOwning`
- `nearbyLibraries`

**Action:** Enhance `lookupFromWorldCat()` to get availability data.

### Priority 5: ISBNdb (if API key available)
- `binding`
- `currentPrice`
- Exact publication date
- Precise dimensions

**Action:** Update `lookupFromISBNdb()` to extract these fields.

## Benefits

Adding these fields provides:

1. **Professional Cataloging** - Dewey, LC, LCCN, Call Numbers
2. **Better Discovery** - Awards, similar books, community shelves
3. **Commercial Intelligence** - Prices, availability, bestseller ranks
4. **Library Integration** - Holdings, nearby library info
5. **Enhanced Metadata** - Quotes, trivia, detailed attribution
6. **International Support** - National library IDs from multiple countries

This makes the system truly comprehensive for both personal and professional library management!

## Next Steps

1. ✅ Book interface updated with all fields
2. ⏳ Update `field-config.ts` to add new field definitions
3. ⏳ Enhance API extractors to populate new fields
4. ⏳ Test form with new categories
5. ⏳ Update backend to store new fields
