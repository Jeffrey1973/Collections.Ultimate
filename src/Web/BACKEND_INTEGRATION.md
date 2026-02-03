# Backend Integration Guide

## ✅ Setup Complete

The frontend is now connected to your .NET backend API at `http://localhost:5258`.

## Current Configuration

### Environment Variables (.env.local)
```
VITE_API_BASE_URL=http://localhost:5258
```

### Temporary Development Household ID
Both `AddBookPage.tsx` and `LibraryPage.tsx` are using a hardcoded household ID:
```typescript
const householdId = '00000000-0000-0000-0000-000000000001'
```

**⚠️ Important:** You'll need to replace this with a real household ID from your database.

## API Integration

### Endpoints Connected

1. **POST** `/api/households/{householdId}/library/books` - Create new book
   - Used in: `AddBookPage.tsx` → `handleSubmit()`
   - Maps frontend book data to backend `CreateBookIngestRequest` format

2. **GET** `/api/households/{householdId}/books?q={query}` - Get all books
   - Used in: `LibraryPage.tsx` → `loadBooks()`
   - Supports search query parameter

### Data Mapping

The frontend `Book` interface is mapped to the backend's structured format:
- **Work** (title, subtitle, description)
- **Edition** (publisher, year, page count, identifiers)
- **Item** (physical copy details, notes, barcode)
- **Contributors** (parsed from author string)
- **Tags** (from categories)
- **Subjects** (from subjects array)

## Next Steps

### 1. Get a Real Household ID

**Option A:** Create via API
```typescript
import { createHousehold } from './api/backend'
const household = await createHousehold('My Library')
console.log(household.id) // Use this ID
```

**Option B:** Query your database
```sql
SELECT TOP 1 Id FROM Households
```

### 2. Implement Authentication

Replace hardcoded household ID with authenticated user's household:

```typescript
// In a new auth context/hook
const { user, household } = useAuth()

// Then use in pages:
const householdId = household.id
```

### 3. Test the Integration

1. Make sure your .NET API is running on port 5258
2. Restart the Vite dev server (it needs to reload the new .env variable):
   ```
   Ctrl+C in terminal, then: npm run dev
   ```
3. Navigate to http://localhost:5173/add
4. Add a book (via ISBN lookup or manual entry)
5. Check http://localhost:5173/library to see it displayed
6. Verify in your database that the data was saved correctly

## API Client Functions

All backend communication is in `src/api/backend.ts`:

- `createBook(data, householdId)` - Add a book
- `getBooks(householdId, { q, take, skip })` - List books
- `getItems(householdId, filters)` - List all items with advanced filters
- `getItem(itemId)` - Get single item
- `updateItem(itemId, data)` - Update item details
- `createHousehold(name)` - Create new household
- `getHouseholds(accountId)` - List households for account

## Troubleshooting

### "Failed to add book" error
- Verify backend API is running on http://localhost:5258
- Check browser console for detailed error messages
- Verify the household ID exists in your database

### Books not showing in library
- Check browser Network tab for API response
- Verify the householdId matches between add and library pages
- Check backend database for saved records

### Data format mismatch
- See `CreateBookIngestRequest` in `backend.ts` for expected format
- Adjust identifier type IDs, role IDs, and scheme IDs to match your backend enums
