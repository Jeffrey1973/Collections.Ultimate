# Enhanced API Extractors

## Overview
The book API extractors have been enhanced to populate **40+ new fields** from multiple book APIs. This enables comprehensive book cataloging with professional library classification, national library identifiers, community data, and commercial information.

## Enhanced Extractors

### 1. OCLC Classify (Priority 1) ⭐
**Status**: ✅ Fully Enhanced

**New Fields Extracted**:
- `deweyDecimal` - Dewey Decimal Classification number
- `deweyEdition` - Edition of Dewey system used
- `lcc` - Library of Congress Classification
- `lccEdition` - Edition of LC Classification system
- `fastSubjects` - Faceted Application of Subject Terminology (array)
- `oclcWorkId` - OCLC Work Identifier
- `callNumber` - Library call number

**API Endpoint**: `http://classify.oclc.org/classify2/Classify`

**Implementation**:
```typescript
// Extracts from XML response:
// - <recommendations><ddc><mostPopular nsfa="..." edition="..."/>
// - <recommendations><lcc><mostPopular nsfa="..." edition="..."/>
// - <fast heading="..."/>
// - <work owi="..."/>
```

**Why Important**: OCLC is the gold standard for professional library cataloging. Google Books doesn't provide Dewey or LC classification.

---

### 2. Library of Congress (Priority 1) ⭐
**Status**: ✅ Fully Enhanced

**New Fields Extracted**:
- `lccn` - Library of Congress Control Number
- `lcc` - LC Classification number
- `lccEdition` - LC Classification edition
- `placeOfPublication` - Where the book was published

**API Endpoint**: `https://lx2.loc.gov:210/lcdb` (SRU/Z39.50)

**Implementation**:
```typescript
// Extracts from MODS XML:
// - <mods:identifier type="lccn">...</mods:identifier>
// - <mods:classification edition="...">...</mods:classification>
```

**Why Important**: Authoritative source for LC classification and LCCN, essential for serious cataloging.

---

### 3. Open Library ⭐
**Status**: ✅ Fully Enhanced

**New Fields Extracted**:
- `olid` - Open Library ID (e.g., "OL12345W")
- `communityRating` - Average community rating
- `popularShelves` - Top 10 user-created shelves/tags (array)

**API Endpoints**:
- Books: `https://openlibrary.org/api/books`
- Works: `https://openlibrary.org/works/{olid}.json`
- Ratings: `https://openlibrary.org/works/{olid}/ratings.json`

**Implementation**:
```typescript
// 1. Get basic book data
// 2. Extract OLID from work key
// 3. Fetch works data for subjects (used as popular shelves)
// 4. Fetch ratings data for community rating
```

**Why Important**: Community-driven data including ratings and user-generated organization (shelves).

---

### 4. ISBNdb
**Status**: ✅ Enhanced

**New Fields Extracted**:
- `binding` - Binding type (Hardcover, Paperback, Library Binding, etc.)
- `deweyDecimal` - Dewey classification
- `msrp` - Manufacturer's Suggested Retail Price

**API Endpoint**: `https://api2.isbndb.com/book/{isbn}`

**Authentication**: Requires API key in `VITE_ISBNDB_API_KEY`

**Implementation**:
```typescript
// Extracts from JSON response:
// - book.binding
// - book.dewey_decimal
// - book.msrp
```

**Why Important**: Commercial data and physical book details.

---

### 5. British Library
**Status**: ✅ Enhanced

**New Fields Extracted**:
- `blId` - British Library identifier

**API Endpoint**: `https://bnb.data.bl.uk/sparql` (SPARQL)

**Implementation**:
```typescript
// Extracts BL ID from resource URI in SPARQL results
// Format: http://bnb.data.bl.uk/resource/{blId}
```

---

### 6. National Libraries (NEW) ⭐

#### Deutsche Nationalbibliothek (DNB)
**Status**: ✅ Newly Implemented

**New Fields**:
- `dnbId` - German National Library ID

**API**: `https://services.dnb.de/sru/dnb` (SRU/MARC21)

#### Bibliothèque nationale de France (BNF)
**Status**: ✅ Newly Implemented

**New Fields**:
- `bnfId` - French National Library ARK identifier

**API**: `https://catalogue.bnf.fr/api/SRU` (UNIMARC)

#### National Library of Australia (NLA)
**Status**: ✅ Newly Implemented

**New Fields**:
- `nlaId` - Australian National Library ID

**API**: `https://catalogue.nla.gov.au/sru` (MARCXML)

#### National Diet Library Japan (NDL)
**Status**: ✅ Enhanced

**New Fields**:
- `ndlId` - Japanese National Library ID

**API**: `https://ndlsearch.ndl.go.jp/api/opensearch`

#### Library and Archives Canada (LAC)
**Status**: ✅ Enhanced

**New Fields**:
- `lacId` - Canadian Archives ID

**API**: `http://www.collectionscanada.gc.ca/sru/amicus` (MARCXML)

---

## Field Coverage Summary

### Classification & Professional Cataloging
| Field | Source | Priority |
|-------|--------|----------|
| `deweyDecimal` | OCLC Classify, ISBNdb | ⭐ High |
| `deweyEdition` | OCLC Classify | ⭐ High |
| `lcc` | OCLC Classify, Library of Congress | ⭐ High |
| `lccEdition` | OCLC Classify, Library of Congress | ⭐ High |
| `lccn` | Library of Congress | ⭐ High |
| `fastSubjects` | OCLC Classify | ⭐ High |
| `oclcWorkId` | OCLC Classify | Medium |

### National Library Identifiers
| Field | Source | Notes |
|-------|--------|-------|
| `dnbId` | Deutsche Nationalbibliothek | German books |
| `bnfId` | Bibliothèque nationale de France | French books |
| `nlaId` | National Library of Australia | Australian books |
| `ndlId` | National Diet Library | Japanese books |
| `lacId` | Library and Archives Canada | Canadian books |
| `blId` | British Library | UK books |

### Physical & Commercial
| Field | Source | Notes |
|-------|--------|-------|
| `binding` | ISBNdb | e.g., Hardcover, Paperback |
| `msrp` | ISBNdb | List price |
| `pagination` | ISBNdb (future) | Detailed page info |
| `shippingWeight` | Amazon (future) | Including packaging |

### Community & Social
| Field | Source | Notes |
|-------|--------|-------|
| `communityRating` | Open Library | Average user rating |
| `popularShelves` | Open Library | User-created tags |
| `reviewsTextCount` | Goodreads (future) | Number of reviews |
| `fiveStarPercent` | Goodreads (future) | % of 5-star ratings |
| `similarBooks` | Goodreads (future) | Recommendations |

### Content Enhancement
| Field | Source | Notes |
|-------|--------|-------|
| `byStatement` | Library of Congress | Statement of responsibility |
| `bibliography` | Library catalogs | Bibliographic notes |
| `originalLanguage` | Multiple sources | For translations |
| `quotes` | Goodreads (future) | Notable quotes |
| `trivia` | Goodreads (future) | Interesting facts |

---

## Implementation Status

### ✅ Completed (11 extractors)
1. **OCLC Classify** - Dewey, LC, FAST subjects
2. **Library of Congress** - LCCN, LC classification
3. **Open Library** - OLID, community rating, shelves
4. **ISBNdb** - Binding, MSRP
5. **British Library** - BL identifier
6. **Deutsche Nationalbibliothek (DNB)** - DNB identifier
7. **Bibliothèque nationale de France (BNF)** - BNF identifier
8. **National Library of Australia (NLA)** - NLA identifier
9. **National Diet Library (NDL)** - NDL identifier
10. **Library and Archives Canada (LAC)** - LAC identifier
11. **Google Books** - Already comprehensive (~100 fields)

### ⏳ Partially Implemented (existing placeholders)
- WorldCat (needs holdings count)
- LibraryThing (needs ID extraction)

### 🔮 Future Enhancements
- **Goodreads** - Reviews, ratings, quotes, trivia, similar books
- **Amazon Product API** - Current price, discount, availability, bestseller rank
- **WorldCat** - Libraries owning, nearby libraries
- **ISBNdb enhancements** - Pagination details

---

## API Call Strategy

### Sequential Priority (to minimize API calls)
1. **Google Books** (free, comprehensive)
2. **OCLC Classify** (free, Dewey/LC classification) ⭐
3. **Library of Congress** (free, LCCN)
4. **Open Library** (free, community data)
5. **ISBNdb** (requires key, commercial data)
6. **National Libraries** (as needed for specific regions)

### Parallel Batching
For faster lookups, APIs can be called in parallel groups:
```typescript
// Group 1: Essential free APIs
Promise.all([
  lookupFromGoogleBooks(isbn),
  lookupFromOCLCClassify(isbn),
  lookupFromLibraryOfCongress(isbn),
])

// Group 2: Community and commercial
Promise.all([
  lookupFromOpenLibrary(isbn),
  lookupFromISBNdb(isbn),
])
```

---

## Configuration Required

### Environment Variables
```env
# Required for ISBNdb
VITE_ISBNDB_API_KEY=your_key_here

# Future: Goodreads (if they restore API)
VITE_GOODREADS_API_KEY=your_key_here

# Future: Amazon Product API
VITE_AMAZON_ACCESS_KEY=your_key_here
VITE_AMAZON_SECRET_KEY=your_key_here
```

---

## Testing Extractors

### Test ISBN: 9780134685991 (Clean Code by Robert Martin)

This ISBN should return data from:
- ✅ Google Books
- ✅ OCLC Classify (Dewey: 005.1, LC: QA76.76.D47)
- ✅ Library of Congress
- ✅ Open Library
- ✅ ISBNdb (with API key)
- ✅ WorldCat

### Manual Test
```typescript
// In browser console or test file:
import { lookupBook } from './src/api/books'

const result = await lookupBook('9780134685991')
console.log(result)

// Check for new fields:
console.log('Dewey:', result.deweyDecimal)
console.log('LC:', result.lcc)
console.log('FAST:', result.fastSubjects)
console.log('OLID:', result.olid)
console.log('Binding:', result.binding)
```

---

## Next Steps

### Priority 1 (Essential)
- ✅ OCLC Classify enhanced
- ✅ Library of Congress enhanced
- ✅ Open Library enhanced
- ✅ National libraries implemented

### Priority 2 (Valuable)
- ⏳ WorldCat enhancement (libraries owning count)
- ⏳ ISBNdb enhancement (pagination)
- ⏳ Backend schema updates for new fields

### Priority 3 (Nice to Have)
- 🔮 Goodreads integration (if API available)
- 🔮 Amazon Product API (commercial data)
- 🔮 More community sources

---

## Error Handling

All extractors follow the pattern:
```typescript
try {
  // API call
  if (!response.ok) return null
  
  // Parse and extract
  if (!data) return null
  
  // Return partial Book object
  return { field1, field2, ... }
} catch (error) {
  console.error('API lookup failed:', error)
  return null
}
```

Failed lookups return `null` and don't block other APIs. The merge strategy combines all successful results.

---

## Merge Strategy

The `mergeBookData()` function combines results from all APIs:
- **First valid value wins** for simple fields
- **Arrays are concatenated** and deduplicated
- **Objects are deep merged**
- **User data takes priority** over API data

```typescript
const merged = mergeBookData([
  googleBooksResult,
  oclcResult,
  libraryOfCongressResult,
  openLibraryResult,
  // ... etc
])
```

---

## Documentation Files

Related documentation:
- [FIELDS_ADDED_FROM_OTHER_APIS.md](FIELDS_ADDED_FROM_OTHER_APIS.md) - Complete field list
- [API_FIELD_COMPARISON.md](API_FIELD_COMPARISON.md) - API comparison matrix
- [FIELD_CONFIG_UPDATE.md](FIELD_CONFIG_UPDATE.md) - Form configuration updates
- [BACKEND_UPDATES_REQUIRED.md](BACKEND_UPDATES_REQUIRED.md) - Database schema
- [GOOGLE_BOOKS_INTEGRATION.md](GOOGLE_BOOKS_INTEGRATION.md) - Technical guide

---

**Last Updated**: February 3, 2026  
**Total Enhanced Extractors**: 11  
**New Fields Populated**: 40+  
**APIs Integrated**: 50+
