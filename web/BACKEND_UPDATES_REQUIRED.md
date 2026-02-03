# Backend Updates Required for Google Books Integration

## Overview
The frontend now captures ~140 fields from Google Books API. The backend needs updates to store and retrieve this comprehensive data.

## Priority Levels
- 🔴 **CRITICAL** - Required for basic functionality
- 🟡 **HIGH** - Important for full feature support  
- 🟢 **MEDIUM** - Nice to have, not blocking
- 🔵 **LOW** - Future enhancements

## Database Schema Updates

### 🔴 CRITICAL: Custom Fields Support

**Add to Items table:**
```sql
ALTER TABLE Items 
ADD COLUMN custom_fields JSONB;

CREATE INDEX idx_items_custom_fields 
ON Items USING GIN (custom_fields);
```

**Purpose:** Store user-defined custom fields as flexible key-value pairs.

### 🟡 HIGH: Extended Google Books Metadata

**Add to Editions table:**
```sql
ALTER TABLE Editions 
ADD COLUMN google_books_data JSONB,
ADD COLUMN sale_info JSONB,
ADD COLUMN access_info JSONB;

CREATE INDEX idx_editions_google_books 
ON Editions USING GIN (google_books_data);
```

**google_books_data structure:**
```json
{
  "etag": "string",
  "selfLink": "string",
  "contentVersion": "string",
  "readingModes": {
    "text": true,
    "image": true
  },
  "maturityRating": "string",
  "allowAnonLogging": true,
  "panelization": {
    "containsEpubBubbles": false,
    "containsImageBubbles": false
  },
  "subtitleLanguage": "string",
  "otherTitles": []
}
```

**sale_info structure:**
```json
{
  "country": "US",
  "saleability": "FOR_SALE",
  "isEbook": true,
  "listPrice": {
    "amount": 29.99,
    "currencyCode": "USD"
  },
  "retailPrice": {
    "amount": 24.99,
    "currencyCode": "USD"
  },
  "buyLink": "https://..."
}
```

**access_info structure:**
```json
{
  "viewability": "PARTIAL",
  "embeddable": true,
  "publicDomain": false,
  "textToSpeechPermission": "ALLOWED",
  "epub": {
    "isAvailable": true,
    "downloadLink": "https://...",
    "acsTokenLink": "https://..."
  },
  "pdf": {
    "isAvailable": true,
    "downloadLink": "https://...",
    "acsTokenLink": "https://..."
  },
  "webReaderLink": "https://...",
  "quoteSharingAllowed": true
}
```

### 🟡 HIGH: Physical Details

**Add to Editions table:**
```sql
ALTER TABLE Editions
ADD COLUMN dimensions_height VARCHAR(50),
ADD COLUMN dimensions_width VARCHAR(50),
ADD COLUMN dimensions_thickness VARCHAR(50),
ADD COLUMN print_type VARCHAR(50),
ADD COLUMN maturity_rating VARCHAR(50);
```

### 🟢 MEDIUM: Cover Images (Multiple Sizes)

**Add to Editions table:**
```sql
ALTER TABLE Editions
ADD COLUMN cover_images JSONB;
```

**cover_images structure:**
```json
{
  "smallThumbnail": "https://...",
  "thumbnail": "https://...",
  "small": "https://...",
  "medium": "https://...",
  "large": "https://...",
  "extraLarge": "https://..."
}
```

### 🟢 MEDIUM: Series Information

**Add to Editions table:**
```sql
ALTER TABLE Editions
ADD COLUMN series_info JSONB;
```

**series_info structure:**
```json
{
  "seriesId": "string",
  "seriesName": "string",
  "volumeNumber": "3"
}
```

### 🟢 MEDIUM: User Information

**Create new table for user-specific book data:**
```sql
CREATE TABLE UserBookData (
  user_id UUID NOT NULL,
  item_id UUID NOT NULL,
  is_purchased BOOLEAN,
  is_preordered BOOLEAN,
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_review TEXT,
  user_review_date TIMESTAMP,
  reading_position VARCHAR(50),
  reading_position_updated TIMESTAMP,
  notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id),
  FOREIGN KEY (item_id) REFERENCES Items(item_id) ON DELETE CASCADE
);
```

### 🔵 LOW: External Links

**Add to Editions table:**
```sql
ALTER TABLE Editions
ADD COLUMN preview_link TEXT,
ADD COLUMN info_link TEXT,
ADD COLUMN canonical_volume_link TEXT;
```

## API Endpoint Updates

### 🔴 CRITICAL: POST /api/households/{id}/library/books

**Update request schema to accept:**
```typescript
interface CreateBookIngestRequestExtended extends CreateBookIngestRequest {
  // Add custom fields
  customFields?: Record<string, any>
  
  // Add Google Books metadata
  googleBooksMetadata?: {
    etag?: string
    selfLink?: string
    contentVersion?: string
    readingModes?: { text: boolean; image: boolean }
    maturityRating?: string
    allowAnonLogging?: boolean
    panelization?: {
      containsEpubBubbles: boolean
      containsImageBubbles: boolean
    }
    subtitleLanguage?: string
    otherTitles?: string[]
  }
  
  // Add sale info
  saleInfo?: {
    country?: string
    saleability?: string
    isEbook?: boolean
    listPrice?: { amount: number; currencyCode: string }
    retailPrice?: { amount: number; currencyCode: string }
    buyLink?: string
  }
  
  // Add access info
  accessInfo?: {
    viewability?: string
    embeddable?: boolean
    publicDomain?: boolean
    textToSpeechPermission?: string
    epub?: {
      isAvailable: boolean
      downloadLink?: string
      acsTokenLink?: string
    }
    pdf?: {
      isAvailable: boolean
      downloadLink?: string
      acsTokenLink?: string
    }
    webReaderLink?: string
    quoteSharingAllowed?: boolean
  }
  
  // Add physical details
  physicalDetails?: {
    dimensionsHeight?: string
    dimensionsWidth?: string
    dimensionsThickness?: string
    printType?: string
  }
  
  // Add cover images
  coverImages?: {
    smallThumbnail?: string
    thumbnail?: string
    small?: string
    medium?: string
    large?: string
    extraLarge?: string
  }
  
  // Add series info
  seriesInfo?: {
    seriesId?: string
    seriesName?: string
    volumeNumber?: string
  }
}
```

**Update response schema to return:**
- All new fields in the response
- Custom fields in `item.customFields`
- Extended metadata in appropriate sections

### 🟡 HIGH: GET /api/households/{id}/library/books/{bookId}

**Update to return all new fields:**
```typescript
interface BookDetailResponse {
  // ... existing fields
  customFields?: Record<string, any>
  googleBooksData?: object
  saleInfo?: object
  accessInfo?: object
  coverImages?: object
  seriesInfo?: object
  physicalDetails?: {
    dimensionsHeight?: string
    dimensionsWidth?: string
    dimensionsThickness?: string
  }
}
```

### 🟢 MEDIUM: Field Selection Support

Add query parameter for field selection:
```
GET /api/households/{id}/library/books?fields=title,author,customFields
```

This allows clients to request only needed fields, reducing payload size.

## Validation Rules

### 🔴 CRITICAL: Custom Fields
- Keys must be strings
- Keys cannot contain: `.`, `$`, or start with `_`
- Values can be any JSON-serializable type
- Maximum custom field size: 10KB per book
- Maximum number of custom fields: 100 per book

### 🟡 HIGH: Data Type Validation
```typescript
// Price amounts
listPriceAmount?: number (0 to 999999.99)
retailPriceAmount?: number (0 to 999999.99)

// Ratings
averageRating?: number (0 to 5, precision 0.1)
userRating?: number (1 to 5, integer)

// Boolean fields
isEbook, embeddable, publicDomain, etc.: boolean

// URLs
Must be valid HTTP/HTTPS URLs
```

## Migration Strategy

### Phase 1: Schema Updates (Week 1)
1. Run database migrations
2. Deploy backend with new columns (nullable)
3. Existing data continues to work
4. New fields start accepting data

### Phase 2: Data Enrichment (Week 2)
1. Create background job to re-fetch Google Books data for existing books
2. Populate new fields from API responses
3. Monitor and log any errors

### Phase 3: Frontend Deployment (Week 3)
1. Deploy updated frontend with new form
2. Users can now enter comprehensive data
3. Custom fields become available

### Phase 4: Optimization (Ongoing)
1. Add indexes based on query patterns
2. Implement field selection for performance
3. Add caching for frequently accessed metadata
4. Monitor JSONB query performance

## Code Changes Required

### 1. Update Domain Models
```csharp
// Domain/Entities/Edition.cs
public class Edition
{
    // ... existing properties
    
    [Column(TypeName = "jsonb")]
    public GoogleBooksData? GoogleBooksMetadata { get; set; }
    
    [Column(TypeName = "jsonb")]
    public SaleInfo? SaleInformation { get; set; }
    
    [Column(TypeName = "jsonb")]
    public AccessInfo? AccessInformation { get; set; }
    
    public string? DimensionsHeight { get; set; }
    public string? DimensionsWidth { get; set; }
    public string? DimensionsThickness { get; set; }
    public string? PrintType { get; set; }
    
    [Column(TypeName = "jsonb")]
    public CoverImages? CoverImageUrls { get; set; }
    
    [Column(TypeName = "jsonb")]
    public SeriesInfo? SeriesInformation { get; set; }
}

// Domain/Entities/Item.cs
public class Item
{
    // ... existing properties
    
    [Column(TypeName = "jsonb")]
    public Dictionary<string, object>? CustomFields { get; set; }
}
```

### 2. Update DTOs
```csharp
// Application/DTOs/CreateBookIngestRequest.cs
public class CreateBookIngestRequest
{
    // ... existing properties
    
    public Dictionary<string, object>? CustomFields { get; set; }
    public GoogleBooksMetadataDto? GoogleBooksMetadata { get; set; }
    public SaleInfoDto? SaleInfo { get; set; }
    public AccessInfoDto? AccessInfo { get; set; }
    public PhysicalDetailsDto? PhysicalDetails { get; set; }
    public CoverImagesDto? CoverImages { get; set; }
    public SeriesInfoDto? SeriesInfo { get; set; }
}
```

### 3. Update Database Context
```csharp
// Infrastructure/Persistence/ApplicationDbContext.cs
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // ... existing configurations
    
    modelBuilder.Entity<Edition>(entity =>
    {
        entity.Property(e => e.GoogleBooksMetadata)
              .HasColumnType("jsonb");
        
        entity.HasIndex(e => e.GoogleBooksMetadata)
              .HasMethod("gin");
    });
    
    modelBuilder.Entity<Item>(entity =>
    {
        entity.Property(i => i.CustomFields)
              .HasColumnType("jsonb");
        
        entity.HasIndex(i => i.CustomFields)
              .HasMethod("gin");
    });
}
```

### 4. Update Service Layer
```csharp
// Application/Services/BookService.cs
public async Task<ItemResponse> CreateBook(
    CreateBookIngestRequest request,
    Guid householdId)
{
    // ... existing logic
    
    // Map custom fields
    if (request.CustomFields != null)
    {
        item.CustomFields = request.CustomFields;
    }
    
    // Map Google Books metadata
    if (request.GoogleBooksMetadata != null)
    {
        edition.GoogleBooksMetadata = _mapper.Map<GoogleBooksData>(
            request.GoogleBooksMetadata
        );
    }
    
    // Map sale info
    if (request.SaleInfo != null)
    {
        edition.SaleInformation = _mapper.Map<SaleInfo>(
            request.SaleInfo
        );
    }
    
    // Map access info
    if (request.AccessInfo != null)
    {
        edition.AccessInformation = _mapper.Map<AccessInfo>(
            request.AccessInfo
        );
    }
    
    // Map physical details
    if (request.PhysicalDetails != null)
    {
        edition.DimensionsHeight = request.PhysicalDetails.DimensionsHeight;
        edition.DimensionsWidth = request.PhysicalDetails.DimensionsWidth;
        edition.DimensionsThickness = request.PhysicalDetails.DimensionsThickness;
        edition.PrintType = request.PhysicalDetails.PrintType;
    }
    
    // Map cover images
    if (request.CoverImages != null)
    {
        edition.CoverImageUrls = _mapper.Map<CoverImages>(
            request.CoverImages
        );
    }
    
    // Map series info
    if (request.SeriesInfo != null)
    {
        edition.SeriesInformation = _mapper.Map<SeriesInfo>(
            request.SeriesInfo
        );
    }
    
    // ... rest of logic
}
```

## Testing Requirements

### 🔴 CRITICAL Tests
- [ ] Create book with custom fields
- [ ] Retrieve book with custom fields
- [ ] Update custom fields
- [ ] Delete custom fields
- [ ] Custom field validation (size limits, key constraints)

### 🟡 HIGH Tests
- [ ] Create book with full Google Books metadata
- [ ] Retrieve book with all extended fields
- [ ] JSONB queries on google_books_data
- [ ] Migration runs successfully on existing data

### 🟢 MEDIUM Tests
- [ ] Field selection query parameter
- [ ] Performance with large JSONB columns
- [ ] Index usage on JSONB columns

## Performance Considerations

### JSONB Indexes
```sql
-- Full text search on custom fields
CREATE INDEX idx_items_custom_fields_gin 
ON Items USING GIN (custom_fields jsonb_path_ops);

-- Specific key queries
CREATE INDEX idx_items_custom_field_shelf 
ON Items ((custom_fields->>'shelf'));
```

### Query Examples
```sql
-- Find books with specific custom field
SELECT * FROM Items 
WHERE custom_fields ? 'shelf';

-- Find books with custom field value
SELECT * FROM Items 
WHERE custom_fields->>'shelf' = 'Living Room A3';

-- Find ebooks
SELECT e.* FROM Editions e
WHERE e.sale_info->>'isEbook' = 'true';

-- Find embeddable books
SELECT e.* FROM Editions e
WHERE e.access_info->>'embeddable' = 'true';
```

## Security Considerations

### Custom Fields
- Sanitize all custom field keys and values
- Limit depth of nested objects (max 3 levels)
- Prevent script injection in stored values
- Rate limit custom field creation

### API Access
- Ensure users can only access their household's data
- Validate all JSONB input
- Prevent NoSQL injection in JSONB queries
- Log suspicious custom field patterns

## Rollback Plan

If issues occur:
1. New columns are nullable - no data loss
2. Backend can revert to previous version
3. Frontend falls back to basic fields
4. Custom fields stored but not displayed
5. Full system continues functioning

## Documentation Updates

- [ ] Update API documentation (OpenAPI/Swagger)
- [ ] Update database schema diagrams
- [ ] Create custom fields usage guide
- [ ] Add examples to API docs
- [ ] Document JSONB query patterns

## Timeline Estimate

- **Schema Updates**: 2-3 days
- **Backend Code Changes**: 3-5 days
- **Testing**: 2-3 days
- **Migration & Deployment**: 1-2 days
- **Total**: 8-13 days

## Questions for Backend Team

1. PostgreSQL version? (JSONB requires 9.4+)
2. Preferred approach: JSONB vs. separate tables?
3. Current backup/restore strategy for JSONB data?
4. Performance requirements for custom field queries?
5. Authentication/authorization for custom fields?
6. Maximum database size constraints?

## Summary

The frontend is ready! Backend updates are straightforward:
- ✅ Add JSONB columns for flexible data
- ✅ Update domain models and DTOs
- ✅ Implement validation rules
- ✅ Create indexes for performance
- ✅ Test thoroughly

This provides a solid foundation for comprehensive book cataloging while maintaining backward compatibility.
