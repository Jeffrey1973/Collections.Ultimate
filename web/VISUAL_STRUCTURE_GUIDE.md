# Visual Structure Guide - Google Books Integration

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│                   (AddBookPage.tsx)                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Search Bar / Barcode Scanner                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  16 Collapsible Categories                           │  │
│  │  ├─ 📚 Basic Information                             │  │
│  │  ├─ 🔖 Identifiers                                   │  │
│  │  ├─ 📑 Classification                                │  │
│  │  ├─ 📅 Publication                                   │  │
│  │  ├─ ✍️ Contributors                                  │  │
│  │  ├─ 📏 Physical Details                              │  │
│  │  ├─ 📖 Content & Reading                             │  │
│  │  ├─ 📚 Series                                        │  │
│  │  ├─ ⭐ Ratings                                       │  │
│  │  ├─ 🖼️ Cover Images                                  │  │
│  │  ├─ 🔓 Access & Availability                         │  │
│  │  ├─ 💰 Sales Information                             │  │
│  │  ├─ 🔗 External Links                                │  │
│  │  ├─ 👤 User Information                              │  │
│  │  ├─ ⚙️ Metadata                                      │  │
│  │  └─ ✨ Custom Fields                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   CONFIGURATION LAYER                       │
│                  (field-config.ts)                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Category   │  │    Field     │  │   Helper     │     │
│  │    Config    │  │  Definitions │  │  Functions   │     │
│  │              │  │              │  │              │     │
│  │  • 16 cats   │  │  • ~140      │  │  • getFields │     │
│  │  • Icons     │  │    fields    │  │    ByCategory│     │
│  │  • Labels    │  │  • Types     │  │  • getCategory│    │
│  │  • Defaults  │  │  • Sources   │  │    Config    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                             │
│                    (books.ts)                               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Book Interface (~140 fields)                        │  │
│  │  ├─ Core: id, householdId, title, author            │  │
│  │  ├─ Basic Info: subtitle, description, pageCount    │  │
│  │  ├─ Identifiers: isbn*, lccn, oclc, doi, asin      │  │
│  │  ├─ Classification: dewey, lcc, subjects            │  │
│  │  ├─ Physical: dimensions*, format, weight           │  │
│  │  ├─ Digital: epub*, pdf*, webReader                 │  │
│  │  ├─ Commercial: prices*, saleability, buyLink       │  │
│  │  ├─ Series: seriesInfo, volumeNumber                │  │
│  │  ├─ Content: description, excerpt, snippet          │  │
│  │  ├─ User: notes, customFields{}                     │  │
│  │  └─ Metadata: dataSources[], lastUpdated            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   API INTEGRATION                           │
│              (google-books-types.ts)                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Google Books API v1 Types                           │  │
│  │  ├─ GoogleBooksVolume                                │  │
│  │  │  ├─ VolumeInfo (title, authors, etc.)            │  │
│  │  │  ├─ SaleInfo (prices, buyLink)                   │  │
│  │  │  ├─ AccessInfo (epub, pdf, viewability)          │  │
│  │  │  ├─ SearchInfo (snippet)                         │  │
│  │  │  └─ UserInfo (purchased, reading position)       │  │
│  │  ├─ IndustryIdentifier (ISBN, ISSN)                 │  │
│  │  ├─ ImageLinks (7 sizes)                            │  │
│  │  ├─ Dimensions (h x w x t)                          │  │
│  │  └─ SeriesInfo (name, volume)                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICE                           │
│             Google Books API v1                             │
│  https://www.googleapis.com/books/v1/volumes               │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
User Action: Scan ISBN "9780143127741"
     │
     ├─→ AddBookPage.handleSearch()
     │       │
     │       ├─→ searchBook() in books.ts
     │       │       │
     │       │       ├─→ lookupFromGoogleBooks(isbn)
     │       │       │       │
     │       │       │       ├─→ fetch("https://googleapis.com...")
     │       │       │       │       │
     │       │       │       │       └─→ Returns: GoogleBooksVolume
     │       │       │       │
     │       │       │       ├─→ Parse VolumeInfo
     │       │       │       ├─→ Parse SaleInfo
     │       │       │       ├─→ Parse AccessInfo
     │       │       │       ├─→ Parse ImageLinks
     │       │       │       ├─→ Parse Dimensions
     │       │       │       └─→ Returns: Partial<Book>
     │       │       │
     │       │       └─→ Returns: Book (merged from multiple APIs)
     │       │
     │       └─→ setFormData(book)
     │
     ├─→ Render Form
     │       │
     │       ├─→ For each FIELD_CATEGORY:
     │       │       │
     │       │       ├─→ getFieldsByCategory(category)
     │       │       │
     │       │       ├─→ For each field in category:
     │       │       │       │
     │       │       │       ├─→ renderField(fieldConfig)
     │       │       │       │       │
     │       │       │       │       ├─→ Get value from formData
     │       │       │       │       ├─→ Render appropriate input
     │       │       │       │       │   (text, number, boolean, array)
     │       │       │       │       └─→ Handle onChange
     │       │       │       │
     │       │       │       └─→ Display in UI
     │       │       │
     │       │       └─→ Make collapsible section
     │       │
     │       └─→ Display custom fields section
     │
     └─→ User clicks "Add Book"
             │
             ├─→ handleSubmit()
             │       │
             │       ├─→ Map Book → CreateBookIngestRequest
             │       │       │
             │       │       ├─→ work: { title, subtitle, description }
             │       │       ├─→ edition: { publisher, year, identifiers[] }
             │       │       ├─→ item: { barcode, notes, customFields }
             │       │       ├─→ contributors: []
             │       │       └─→ subjects: []
             │       │
             │       ├─→ createBook(request, householdId)
             │       │       │
             │       │       └─→ POST /api/households/{id}/library/books
             │       │
             │       └─→ navigate('/library')
             │
             └─→ Book saved!
```

## Category → Fields Mapping

```
📚 Basic Information
├─ title *
├─ subtitle
├─ author *
├─ description
├─ language
└─ pageCount

🔖 Identifiers (15 total)
├─ isbn
├─ isbn10
├─ isbn13
├─ issn
├─ lccn
├─ oclcNumber
├─ oclcWorkId
├─ doi
├─ asin
├─ googleBooksId
├─ goodreadsId
├─ libraryThingId
├─ olid
└─ ...

📑 Classification (7 total)
├─ mainCategory
├─ categories[]
├─ subjects[]
├─ deweyDecimal
├─ lcc
├─ callNumber
└─ bisacCodes[]

📅 Publication (8 total)
├─ publisher
├─ publishedDate
├─ originalPublicationDate
├─ edition
├─ editionStatement
├─ placeOfPublication
├─ copyright
└─ printingHistory

✍️ Contributors (5 total)
├─ translator
├─ translatedFrom
├─ illustrator
├─ editor
└─ narrator

📏 Physical Details (7 total)
├─ format
├─ printType
├─ dimensions
├─ dimensionsHeight
├─ dimensionsWidth
├─ dimensionsThickness
└─ weight

📖 Content & Reading (8 total)
├─ tableOfContents
├─ firstSentence
├─ excerpt
├─ textSnippet
├─ readingAge
├─ lexileScore
├─ arLevel
└─ maturityRating

📚 Series (4 total)
├─ series
├─ seriesInfo{}
├─ volumeNumber
└─ numberOfVolumes

⭐ Ratings (3 total)
├─ averageRating
├─ ratingsCount
└─ reviewsCount

🖼️ Cover Images (7 total)
├─ coverImageSmallThumbnail
├─ coverImageThumbnail
├─ coverImageSmall
├─ coverImageMedium
├─ coverImageLarge
├─ coverImageExtraLarge
└─ coverImageUrl (primary)

🔓 Access & Availability (13 total)
├─ viewability
├─ embeddable
├─ publicDomain
├─ textToSpeechPermission
├─ epubAvailable
├─ epubDownloadLink
├─ epubAcsTokenLink
├─ pdfAvailable
├─ pdfDownloadLink
├─ pdfAcsTokenLink
├─ webReaderLink
├─ accessViewStatus
└─ quoteSharingAllowed

💰 Sales Information (9 total)
├─ saleCountry
├─ saleability
├─ onSaleDate
├─ isEbook
├─ listPriceAmount
├─ listPriceCurrency
├─ retailPriceAmount
├─ retailPriceCurrency
└─ buyLink

🔗 External Links (3 total)
├─ previewLink
├─ infoLink
└─ canonicalVolumeLink

👤 User Information (10 total)
├─ isPurchased
├─ isPreordered
├─ userRating
├─ userReviewText
├─ userReviewDate
├─ readingPositionPosition
├─ readingPositionUpdated
├─ userInfoUpdated
└─ notes

⚙️ Metadata (9 total)
├─ etag
├─ selfLink
├─ contentVersion
├─ readingModesText
├─ readingModesImage
├─ allowAnonLogging
├─ dataSources[]
├─ lastUpdated
└─ ...

✨ Custom Fields
└─ customFields{} (unlimited key-value pairs)
```

## File Organization

```
web/
├── src/
│   ├── api/
│   │   ├── google-books-types.ts    [New] TypeScript types for Google Books API
│   │   │   └── 20+ interfaces defining API response structure
│   │   │
│   │   ├── books.ts                 [Updated] Main book API and types
│   │   │   ├── Book interface (~140 fields)
│   │   │   ├── lookupFromGoogleBooks() - Enhanced extraction
│   │   │   ├── searchBook() - Multi-API search
│   │   │   └── Helper functions
│   │   │
│   │   └── backend.ts               [No changes] Backend communication
│   │
│   ├── config/
│   │   └── field-config.ts          [New] Field organization
│   │       ├── CategoryConfig[] - 16 categories
│   │       ├── FieldConfig[] - ~140 field definitions
│   │       ├── getFieldsByCategory()
│   │       └── getCategoryConfig()
│   │
│   ├── pages/
│   │   ├── AddBookPage.tsx          [Replaced] New comprehensive form
│   │   │   ├── Category rendering
│   │   │   ├── Field rendering
│   │   │   ├── Custom fields UI
│   │   │   └── Form submission
│   │   │
│   │   ├── AddBookPage.tsx.v1.backup   [Backup] Original version
│   │   └── AddBookPage.tsx.backup      [Backup] Previous version
│   │
│   └── components/                  [No changes]
│
├── Documentation/
│   ├── GOOGLE_BOOKS_INTEGRATION.md     [New] Complete technical guide
│   ├── QUICK_START_ENHANCED_FORM.md    [New] User guide
│   ├── BACKEND_UPDATES_REQUIRED.md     [New] Backend implementation
│   └── IMPLEMENTATION_SUMMARY.md       [New] Project summary
│
└── package.json                     [No changes]
```

## Type Relationships

```
GoogleBooksVolume (from API)
    │
    ├─ volumeInfo: VolumeInfo
    │   ├─ title → Book.title
    │   ├─ subtitle → Book.subtitle
    │   ├─ authors[] → Book.author (joined)
    │   ├─ publisher → Book.publisher
    │   ├─ publishedDate → Book.publishedDate
    │   ├─ description → Book.description
    │   ├─ pageCount → Book.pageCount
    │   ├─ language → Book.language
    │   ├─ categories[] → Book.categories
    │   ├─ mainCategory → Book.mainCategory
    │   ├─ averageRating → Book.averageRating
    │   ├─ ratingsCount → Book.ratingsCount
    │   ├─ maturityRating → Book.maturityRating
    │   ├─ industryIdentifiers[] → Book.isbn10, isbn13, issn
    │   ├─ imageLinks → Book.coverImage* (7 sizes)
    │   ├─ dimensions → Book.dimensions* (3 fields)
    │   ├─ seriesInfo → Book.seriesInfo, series, volumeNumber
    │   └─ ... (many more)
    │
    ├─ saleInfo: SaleInfo
    │   ├─ saleability → Book.saleability
    │   ├─ isEbook → Book.isEbook
    │   ├─ listPrice → Book.listPriceAmount, listPriceCurrency
    │   ├─ retailPrice → Book.retailPriceAmount, retailPriceCurrency
    │   └─ buyLink → Book.buyLink
    │
    ├─ accessInfo: AccessInfo
    │   ├─ viewability → Book.viewability
    │   ├─ embeddable → Book.embeddable
    │   ├─ publicDomain → Book.publicDomain
    │   ├─ epub → Book.epubAvailable, epubDownloadLink
    │   ├─ pdf → Book.pdfAvailable, pdfDownloadLink
    │   └─ webReaderLink → Book.webReaderLink
    │
    ├─ searchInfo: SearchInfo
    │   └─ textSnippet → Book.textSnippet
    │
    └─ userInfo: UserInfo
        ├─ isPurchased → Book.isPurchased
        ├─ review → Book.userRating, userReviewText
        └─ readingPosition → Book.readingPositionPosition
```

## UI Component Hierarchy

```
AddBookPage
│
├─ Search Section
│  ├─ Barcode Scanner Button
│  └─ Search Form
│
├─ Status Displays
│  ├─ Error Message
│  ├─ Progress Bar
│  └─ Data Sources Info
│
├─ Cover Preview
│
└─ Form
   │
   ├─ Form Header
   │  ├─ Title
   │  ├─ Expand All Button
   │  └─ Collapse All Button
   │
   ├─ Category Sections (16)
   │  │
   │  ├─ Category Header (collapsible)
   │  │  ├─ Icon + Label
   │  │  ├─ Description
   │  │  ├─ "Has Data" Badge (conditional)
   │  │  └─ Expand/Collapse Arrow
   │  │
   │  └─ Category Content (when expanded)
   │     │
   │     └─ Field Inputs (multiple)
   │        ├─ Label (with source)
   │        ├─ Description (optional)
   │        └─ Input (text/number/boolean/array)
   │
   ├─ Custom Fields Section
   │  ├─ Existing Fields List
   │  │  └─ Field Row (name, value, remove button)
   │  │
   │  └─ Add New Field Form
   │     ├─ Field Name Input
   │     ├─ Field Value Input
   │     └─ Add Button
   │
   └─ Action Buttons
      ├─ Submit Button
      └─ Cancel Button
```

## State Management

```
AddBookPage Component State
│
├─ showScanner: boolean
├─ isLoading: boolean
├─ error: string | null
├─ searchInput: string
├─ searchProgress: { current, total, apiName } | null
│
├─ expandedCategories: Set<CategoryKey>
│  └─ Tracks which categories are open
│
├─ customFields: Record<string, any>
│  └─ User-defined fields
│
├─ newCustomFieldName: string
├─ newCustomFieldValue: string
│
└─ formData: Partial<Book>
   └─ All ~140 book fields
```

## Summary Statistics

- **Total TypeScript Interfaces**: 20+
- **Total Book Fields**: ~140
- **Categories**: 16
- **Field Types Supported**: 6 (text, textarea, number, url, boolean, array)
- **API Integrations**: 10+ (Google Books featured)
- **Custom Fields**: Unlimited
- **Lines of Code Added**: ~2,000+
- **Files Created**: 7
- **Files Modified**: 2
- **Files Backed Up**: 2
- **Documentation Pages**: 4

---

This visual guide provides a comprehensive overview of the architecture, data flow, and organization of the Google Books integration implementation.
