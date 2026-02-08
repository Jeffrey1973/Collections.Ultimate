/**
 * Comprehensive field configuration for book forms
 * Organizes all possible book fields into logical, collapsible categories
 */

import type { Book } from '../api/books'

export type FieldType = 'text' | 'textarea' | 'number' | 'url' | 'date' | 'boolean' | 'array' | 'json' | 'select'

export interface FieldConfig {
  key: keyof Book
  label: string
  type: FieldType
  category: CategoryKey
  description?: string
  placeholder?: string
  required?: boolean
  source?: 'google-books' | 'open-library' | 'user' | 'multiple'
  options?: string[]
}

export type CategoryKey = 
  | 'basic'
  | 'historical'
  | 'identifiers'
  | 'classification'
  | 'publication'
  | 'contributors'
  | 'physical'
  | 'content'
  | 'series'
  | 'ratings'
  | 'images'
  | 'access'
  | 'sale'
  | 'commercial'
  | 'community'
  | 'links'
  | 'user'
  | 'metadata'
  | 'custom'

export interface CategoryConfig {
  key: CategoryKey
  label: string
  icon: string
  description: string
  defaultExpanded?: boolean
}

export const FIELD_CATEGORIES: CategoryConfig[] = [
  {
    key: 'basic',
    label: 'Basic Information',
    icon: '📚',
    description: 'Essential book details',
    defaultExpanded: true,
  },
  {
    key: 'historical',
    label: 'Historical & Theological',
    icon: '✝️',
    description: 'Church history period, tradition, and theological context',
  },
  {
    key: 'identifiers',
    label: 'Identifiers',
    icon: '🔖',
    description: 'ISBN, LCCN, and other unique identifiers',
  },
  {
    key: 'classification',
    label: 'Classification & Categories',
    icon: '📑',
    description: 'Dewey Decimal, Library of Congress, subjects',
  },
  {
    key: 'publication',
    label: 'Publication Details',
    icon: '📅',
    description: 'Publisher, dates, edition information',
  },
  {
    key: 'contributors',
    label: 'Contributors',
    icon: '✍️',
    description: 'Authors, editors, translators, illustrators',
  },
  {
    key: 'physical',
    label: 'Physical Details',
    icon: '📏',
    description: 'Dimensions, format, weight',
  },
  {
    key: 'content',
    label: 'Content & Reading',
    icon: '📖',
    description: 'Description, excerpts, reading level',
  },
  {
    key: 'series',
    label: 'Series Information',
    icon: '📚',
    description: 'Series name, volume number',
  },
  {
    key: 'ratings',
    label: 'Ratings & Reviews',
    icon: '⭐',
    description: 'User ratings and reviews',
  },
  {
    key: 'images',
    label: 'Cover Images',
    icon: '🖼️',
    description: 'Cover images in various sizes',
  },
  {
    key: 'access',
    label: 'Access & Availability',
    icon: '🔓',
    description: 'Ebook, PDF, web reader availability',
  },
  {
    key: 'sale',
    label: 'Sales Information',
    icon: '💰',
    description: 'Pricing and purchase options',
  },
  {
    key: 'commercial',
    label: 'Commercial & Availability',
    icon: '🏪',
    description: 'Market prices, availability, library holdings',
  },
  {
    key: 'community',
    label: 'Community Data',
    icon: '👥',
    description: 'Community ratings, shelves, and recommendations',
  },
  {
    key: 'links',
    label: 'External Links',
    icon: '🔗',
    description: 'Preview, info, and buy links',
  },
  {
    key: 'user',
    label: 'User Information',
    icon: '👤',
    description: 'Personal reading progress and reviews',
  },
  {
    key: 'metadata',
    label: 'Metadata & Tracking',
    icon: '⚙️',
    description: 'Internal tracking and data sources',
  },
  {
    key: 'custom',
    label: 'Custom Fields',
    icon: '✨',
    description: 'User-defined custom fields',
  },
]

export const FIELD_DEFINITIONS: FieldConfig[] = [
  // ===== BASIC INFORMATION =====
  {
    key: 'title',
    label: 'Title',
    type: 'text',
    category: 'basic',
    required: true,
    placeholder: 'Enter book title',
    source: 'google-books',
  },
  {
    key: 'subtitle',
    label: 'Subtitle',
    type: 'text',
    category: 'basic',
    placeholder: 'Enter subtitle if any',
    source: 'google-books',
  },
  {
    key: 'author',
    label: 'Author(s)',
    type: 'text',
    category: 'basic',
    required: true,
    placeholder: 'Enter author name(s)',
    source: 'google-books',
  },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    category: 'basic',
    placeholder: 'Book description or summary',
    source: 'google-books',
  },
  {
    key: 'language',
    label: 'Language',
    type: 'text',
    category: 'basic',
    placeholder: 'e.g., en, es, fr',
    source: 'google-books',
  },
  {
    key: 'pageCount',
    label: 'Page Count',
    type: 'number',
    category: 'basic',
    source: 'google-books',
  },

  // ===== HISTORICAL & THEOLOGICAL =====
  {
    key: 'churchHistoryPeriod',
    label: 'Period of Church History',
    type: 'text',
    category: 'historical',
    description: 'Church history period (e.g., Apostolic, Ante-Nicene, Nicene, Post-Nicene, Medieval, Reformation, Enlightenment)',
    placeholder: 'e.g., Reformation',
    source: 'user',
  },
  {
    key: 'dateWritten',
    label: 'Date Written',
    type: 'text',
    category: 'historical',
    description: 'Original composition date (may differ from publication date)',
    placeholder: 'e.g., 325 AD, 1517, 1st century',
    source: 'user',
  },
  {
    key: 'religiousTradition',
    label: 'Tradition',
    type: 'array',
    category: 'historical',
    description: 'Religious tradition(s) or denomination(s) - can specify multiple',
    placeholder: 'e.g., Catholic, Eastern Orthodox, Baptist',
    source: 'user',
  },

  // ===== IDENTIFIERS =====
  {
    key: 'isbn',
    label: 'ISBN',
    type: 'text',
    category: 'identifiers',
    description: 'General ISBN (10 or 13 digit)',
    source: 'google-books',
  },
  {
    key: 'isbn10',
    label: 'ISBN-10',
    type: 'text',
    category: 'identifiers',
    description: '10-digit ISBN',
    source: 'google-books',
  },
  {
    key: 'isbn13',
    label: 'ISBN-13',
    type: 'text',
    category: 'identifiers',
    description: '13-digit ISBN',
    source: 'google-books',
  },
  {
    key: 'issn',
    label: 'ISSN',
    type: 'text',
    category: 'identifiers',
    description: 'International Standard Serial Number',
    source: 'google-books',
  },
  {
    key: 'lccn',
    label: 'LCCN',
    type: 'text',
    category: 'identifiers',
    description: 'Library of Congress Control Number',
  },
  {
    key: 'oclcNumber',
    label: 'OCLC Number',
    type: 'text',
    category: 'identifiers',
    description: 'WorldCat identifier',
  },
  {
    key: 'doi',
    label: 'DOI',
    type: 'text',
    category: 'identifiers',
    description: 'Digital Object Identifier',
  },
  {
    key: 'asin',
    label: 'ASIN',
    type: 'text',
    category: 'identifiers',
    description: 'Amazon Standard Identification Number',
  },
  {
    key: 'googleBooksId',
    label: 'Google Books ID',
    type: 'text',
    category: 'identifiers',
    source: 'google-books',
  },
  {
    key: 'goodreadsId',
    label: 'Goodreads ID',
    type: 'text',
    category: 'identifiers',
  },
  {
    key: 'olid',
    label: 'Open Library ID',
    type: 'text',
    category: 'identifiers',
    source: 'open-library',
  },
  {
    key: 'oclcWorkId',
    label: 'OCLC Work ID',
    type: 'text',
    category: 'identifiers',
    description: 'OCLC Work Identifier',
  },
  {
    key: 'libraryThingId',
    label: 'LibraryThing ID',
    type: 'text',
    category: 'identifiers',
  },
  {
    key: 'dnbId',
    label: 'DNB ID',
    type: 'text',
    category: 'identifiers',
    description: 'Deutsche Nationalbibliothek (German National Library)',
  },
  {
    key: 'bnfId',
    label: 'BNF ID',
    type: 'text',
    category: 'identifiers',
    description: 'Bibliothèque nationale de France',
  },
  {
    key: 'nlaId',
    label: 'NLA ID',
    type: 'text',
    category: 'identifiers',
    description: 'National Library of Australia',
  },
  {
    key: 'ndlId',
    label: 'NDL ID',
    type: 'text',
    category: 'identifiers',
    description: 'National Diet Library (Japan)',
  },
  {
    key: 'lacId',
    label: 'LAC ID',
    type: 'text',
    category: 'identifiers',
    description: 'Library and Archives Canada',
  },
  {
    key: 'blId',
    label: 'BL ID',
    type: 'text',
    category: 'identifiers',
    description: 'British Library',
  },

  // ===== CLASSIFICATION =====
  {
    key: 'mainCategory',
    label: 'Main Category',
    type: 'text',
    category: 'classification',
    source: 'google-books',
  },
  {
    key: 'categories',
    label: 'Categories',
    type: 'array',
    category: 'classification',
    description: 'Genre and category tags',
    source: 'google-books',
  },
  {
    key: 'subjects',
    label: 'Subjects',
    type: 'array',
    category: 'classification',
    description: 'Subject headings',
  },
  {
    key: 'deweyDecimal',
    label: 'Dewey Decimal',
    type: 'text',
    category: 'classification',
    description: 'Dewey Decimal Classification',
  },
  {
    key: 'deweyEdition',
    label: 'Dewey Edition',
    type: 'text',
    category: 'classification',
    description: 'Edition of Dewey Decimal system used',
  },
  {
    key: 'lcc',
    label: 'Library of Congress Classification',
    type: 'text',
    category: 'classification',
  },
  {
    key: 'lccEdition',
    label: 'LC Edition',
    type: 'text',
    category: 'classification',
    description: 'Edition of LC Classification system used',
  },
  {
    key: 'callNumber',
    label: 'Call Number',
    type: 'text',
    category: 'classification',
    description: 'Library shelf location',
  },
  {
    key: 'bisacCodes',
    label: 'BISAC Codes',
    type: 'array',
    category: 'classification',
    description: 'Book Industry Standards codes',
  },
  {
    key: 'fastSubjects',
    label: 'FAST Subjects',
    type: 'array',
    category: 'classification',
    description: 'Faceted Application of Subject Terminology',
  },

  // ===== PUBLICATION =====
  {
    key: 'publisher',
    label: 'Publisher',
    type: 'text',
    category: 'publication',
    source: 'google-books',
  },
  {
    key: 'publishedDate',
    label: 'Published Date',
    type: 'text',
    category: 'publication',
    placeholder: 'YYYY-MM-DD or YYYY',
    source: 'google-books',
  },
  {
    key: 'originalPublicationDate',
    label: 'Original Publication Date',
    type: 'text',
    category: 'publication',
  },
  {
    key: 'edition',
    label: 'Edition',
    type: 'text',
    category: 'publication',
    placeholder: 'e.g., 1st Edition, Revised',
  },
  {
    key: 'editionStatement',
    label: 'Edition Statement',
    type: 'text',
    category: 'publication',
  },
  {
    key: 'placeOfPublication',
    label: 'Place of Publication',
    type: 'text',
    category: 'publication',
  },
  {
    key: 'copyright',
    label: 'Copyright',
    type: 'text',
    category: 'publication',
  },
  {
    key: 'printingHistory',
    label: 'Printing History',
    type: 'textarea',
    category: 'publication',
  },
  {
    key: 'printRun',
    label: 'Print Run',
    type: 'text',
    category: 'publication',
    description: 'Print run information (e.g., "First printing: 5000 copies")',
  },
  {
    key: 'colophon',
    label: 'Colophon',
    type: 'textarea',
    category: 'publication',
    description: 'Publishing and printing details',
  },

  // ===== CONTRIBUTORS =====
  {
    key: 'translator',
    label: 'Translator',
    type: 'text',
    category: 'contributors',
  },
  {
    key: 'translatedFrom',
    label: 'Translated From',
    type: 'text',
    category: 'contributors',
    placeholder: 'Original language',
  },
  {
    key: 'illustrator',
    label: 'Illustrator',
    type: 'text',
    category: 'contributors',
  },
  {
    key: 'editor',
    label: 'Editor',
    type: 'text',
    category: 'contributors',
  },
  {
    key: 'narrator',
    label: 'Narrator',
    type: 'text',
    category: 'contributors',
    description: 'For audiobooks',
  },

  // ===== PHYSICAL DETAILS =====
  {
    key: 'format',
    label: 'Format',
    type: 'text',
    category: 'physical',
    placeholder: 'Hardcover, Paperback, eBook, Audiobook',
    source: 'google-books',
  },
  {
    key: 'printType',
    label: 'Print Type',
    type: 'text',
    category: 'physical',
    description: 'BOOK or MAGAZINE',
    source: 'google-books',
  },
  {
    key: 'dimensions',
    label: 'Dimensions',
    type: 'text',
    category: 'physical',
    placeholder: 'e.g., 9 x 6 x 1 inches',
    source: 'google-books',
  },
  {
    key: 'dimensionsHeight',
    label: 'Height',
    type: 'text',
    category: 'physical',
    source: 'google-books',
  },
  {
    key: 'dimensionsWidth',
    label: 'Width',
    type: 'text',
    category: 'physical',
    source: 'google-books',
  },
  {
    key: 'dimensionsThickness',
    label: 'Thickness',
    type: 'text',
    category: 'physical',
    source: 'google-books',
  },
  {
    key: 'weight',
    label: 'Weight',
    type: 'text',
    category: 'physical',
  },
  {
    key: 'shippingWeight',
    label: 'Shipping Weight',
    type: 'text',
    category: 'physical',
    description: 'Weight including packaging',
  },
  {
    key: 'binding',
    label: 'Binding',
    type: 'text',
    category: 'physical',
    description: 'Binding type (Hardcover, Paperback, Library Binding, etc.)',
  },
  {
    key: 'pagination',
    label: 'Pagination',
    type: 'text',
    category: 'physical',
    description: 'Detailed pagination (e.g., "xvi, 342 p.")',
  },
  {
    key: 'physicalDescription',
    label: 'Physical Description',
    type: 'textarea',
    category: 'physical',
  },

  // ===== CONTENT & READING =====
  {
    key: 'tableOfContents',
    label: 'Table of Contents',
    type: 'textarea',
    category: 'content',
  },
  {
    key: 'firstSentence',
    label: 'First Sentence',
    type: 'textarea',
    category: 'content',
  },
  {
    key: 'excerpt',
    label: 'Excerpt',
    type: 'textarea',
    category: 'content',
  },
  {
    key: 'byStatement',
    label: 'By Statement',
    type: 'text',
    category: 'content',
    description: 'Statement of responsibility (e.g., "by Jane Doe ; edited by John Smith")',
  },
  {
    key: 'bibliography',
    label: 'Bibliography',
    type: 'textarea',
    category: 'content',
    description: 'Bibliographic notes and references',
  },
  {
    key: 'originalLanguage',
    label: 'Original Language',
    type: 'text',
    category: 'content',
    description: 'Original language if translated',
  },
  {
    key: 'quotes',
    label: 'Quotes',
    type: 'textarea',
    category: 'content',
    description: 'Notable quotes from the book',
  },
  {
    key: 'trivia',
    label: 'Trivia',
    type: 'textarea',
    category: 'content',
    description: 'Interesting facts about the book',
  },
  {
    key: 'textSnippet',
    label: 'Text Snippet',
    type: 'textarea',
    category: 'content',
    source: 'google-books',
  },
  {
    key: 'readingAge',
    label: 'Reading Age',
    type: 'text',
    category: 'content',
    placeholder: 'e.g., 8-12 years',
  },
  {
    key: 'lexileScore',
    label: 'Lexile Score',
    type: 'text',
    category: 'content',
  },
  {
    key: 'arLevel',
    label: 'AR Level',
    type: 'text',
    category: 'content',
    description: 'Accelerated Reader level',
  },
  {
    key: 'maturityRating',
    label: 'Maturity Rating',
    type: 'text',
    category: 'content',
    source: 'google-books',
  },

  // ===== SERIES =====
  {
    key: 'series',
    label: 'Series Name',
    type: 'text',
    category: 'series',
    source: 'google-books',
  },
  {
    key: 'volumeNumber',
    label: 'Volume Number',
    type: 'text',
    category: 'series',
    source: 'google-books',
  },
  {
    key: 'numberOfVolumes',
    label: 'Total Volumes',
    type: 'number',
    category: 'series',
  },

  // ===== RATINGS & REVIEWS =====
  {
    key: 'averageRating',
    label: 'Average Rating',
    type: 'number',
    category: 'ratings',
    source: 'google-books',
  },
  {
    key: 'ratingsCount',
    label: 'Number of Ratings',
    type: 'number',
    category: 'ratings',
    source: 'google-books',
  },
  {
    key: 'reviewsTextCount',
    label: 'Text Reviews Count',
    type: 'number',
    category: 'ratings',
    description: 'Number of written reviews',
  },
  {
    key: 'fiveStarPercent',
    label: 'Five Star %',
    type: 'number',
    category: 'ratings',
    description: 'Percentage of 5-star ratings',
  },
  {
    key: 'communityRating',
    label: 'Community Rating',
    type: 'number',
    category: 'ratings',
    description: 'Average community rating (Open Library, Goodreads, etc.)',
  },

  // ===== IMAGES =====
  {
    key: 'coverImageUrl',
    label: 'Cover Image (Primary)',
    type: 'url',
    category: 'images',
    source: 'google-books',
  },
  {
    key: 'coverImageSmallThumbnail',
    label: 'Small Thumbnail',
    type: 'url',
    category: 'images',
    source: 'google-books',
  },
  {
    key: 'coverImageThumbnail',
    label: 'Thumbnail',
    type: 'url',
    category: 'images',
    source: 'google-books',
  },
  {
    key: 'coverImageSmall',
    label: 'Small',
    type: 'url',
    category: 'images',
    source: 'google-books',
  },
  {
    key: 'coverImageMedium',
    label: 'Medium',
    type: 'url',
    category: 'images',
    source: 'google-books',
  },
  {
    key: 'coverImageLarge',
    label: 'Large',
    type: 'url',
    category: 'images',
    source: 'google-books',
  },
  {
    key: 'coverImageExtraLarge',
    label: 'Extra Large',
    type: 'url',
    category: 'images',
    source: 'google-books',
  },

  // ===== ACCESS & AVAILABILITY =====
  {
    key: 'viewability',
    label: 'Viewability',
    type: 'text',
    category: 'access',
    description: 'PARTIAL, ALL_PAGES, NO_PAGES',
    source: 'google-books',
  },
  {
    key: 'embeddable',
    label: 'Embeddable',
    type: 'boolean',
    category: 'access',
    source: 'google-books',
  },
  {
    key: 'publicDomain',
    label: 'Public Domain',
    type: 'boolean',
    category: 'access',
    source: 'google-books',
  },
  {
    key: 'textToSpeechPermission',
    label: 'Text-to-Speech Permission',
    type: 'text',
    category: 'access',
    source: 'google-books',
  },
  {
    key: 'epubAvailable',
    label: 'EPUB Available',
    type: 'boolean',
    category: 'access',
    source: 'google-books',
  },
  {
    key: 'epubDownloadLink',
    label: 'EPUB Download Link',
    type: 'url',
    category: 'access',
    source: 'google-books',
  },
  {
    key: 'pdfAvailable',
    label: 'PDF Available',
    type: 'boolean',
    category: 'access',
    source: 'google-books',
  },
  {
    key: 'pdfDownloadLink',
    label: 'PDF Download Link',
    type: 'url',
    category: 'access',
    source: 'google-books',
  },
  {
    key: 'webReaderLink',
    label: 'Web Reader Link',
    type: 'url',
    category: 'access',
    source: 'google-books',
  },
  {
    key: 'quoteSharingAllowed',
    label: 'Quote Sharing Allowed',
    type: 'boolean',
    category: 'access',
    source: 'google-books',
  },

  // ===== SALES INFORMATION =====
  {
    key: 'saleability',
    label: 'Saleability',
    type: 'text',
    category: 'sale',
    description: 'FOR_SALE, NOT_FOR_SALE, FREE',
    source: 'google-books',
  },
  {
    key: 'isEbook',
    label: 'Is eBook',
    type: 'boolean',
    category: 'sale',
    source: 'google-books',
  },
  {
    key: 'listPriceAmount',
    label: 'List Price',
    type: 'number',
    category: 'sale',
    source: 'google-books',
  },
  {
    key: 'listPriceCurrency',
    label: 'List Price Currency',
    type: 'text',
    category: 'sale',
    source: 'google-books',
  },
  {
    key: 'retailPriceAmount',
    label: 'Retail Price',
    type: 'number',
    category: 'sale',
    source: 'google-books',
  },
  {
    key: 'retailPriceCurrency',
    label: 'Retail Price Currency',
    type: 'text',
    category: 'sale',
    source: 'google-books',
  },
  {
    key: 'buyLink',
    label: 'Buy Link',
    type: 'url',
    category: 'sale',
    source: 'google-books',
  },

  // ===== COMMERCIAL & AVAILABILITY =====
  {
    key: 'currentPrice',
    label: 'Current Price',
    type: 'number',
    category: 'commercial',
    description: 'Current market price',
  },
  {
    key: 'discount',
    label: 'Discount',
    type: 'text',
    category: 'commercial',
    description: 'Discount information',
  },
  {
    key: 'usedPrices',
    label: 'Used Prices',
    type: 'text',
    category: 'commercial',
    description: 'Range of used book prices',
  },
  {
    key: 'availability',
    label: 'Availability',
    type: 'text',
    category: 'commercial',
    description: 'In stock, out of print, etc.',
  },
  {
    key: 'bestsellerRank',
    label: 'Bestseller Rank',
    type: 'text',
    category: 'commercial',
    description: 'Amazon or other ranking',
  },
  {
    key: 'librariesOwning',
    label: 'Libraries Owning',
    type: 'number',
    category: 'commercial',
    description: 'Number of libraries that own this book',
  },
  {
    key: 'nearbyLibraries',
    label: 'Nearby Libraries',
    type: 'array',
    category: 'commercial',
    description: 'Libraries near you with this book',
  },

  // ===== COMMUNITY DATA =====
  {
    key: 'popularShelves',
    label: 'Popular Shelves',
    type: 'array',
    category: 'community',
    description: 'Common user-created shelves/tags (Goodreads, Open Library)',
  },
  {
    key: 'similarBooks',
    label: 'Similar Books',
    type: 'array',
    category: 'community',
    description: 'Recommendations from community',
  },

  // ===== LINKS =====
  {
    key: 'previewLink',
    label: 'Preview Link',
    type: 'url',
    category: 'links',
    source: 'google-books',
  },
  {
    key: 'infoLink',
    label: 'Info Link',
    type: 'url',
    category: 'links',
    source: 'google-books',
  },
  {
    key: 'canonicalVolumeLink',
    label: 'Canonical Volume Link',
    type: 'url',
    category: 'links',
    source: 'google-books',
  },

  // ===== USER INFORMATION =====
  {
    key: 'isPurchased',
    label: 'Purchased',
    type: 'boolean',
    category: 'user',
    source: 'google-books',
  },
  {
    key: 'isPreordered',
    label: 'Pre-ordered',
    type: 'boolean',
    category: 'user',
    source: 'google-books',
  },
  {
    key: 'userRating',
    label: 'Your Rating',
    type: 'number',
    category: 'user',
    source: 'google-books',
  },
  {
    key: 'userReviewText',
    label: 'Your Review',
    type: 'textarea',
    category: 'user',
    source: 'google-books',
  },
  {
    key: 'pln',
    label: 'Physical Location',
    type: 'text',
    category: 'user',
    description: 'Where this book is physically stored (e.g., Living Room Bookshelf, Office)',
    source: 'user',
  },
  {
    key: 'readStatus',
    label: 'Read Status',
    type: 'select',
    category: 'user',
    description: 'Your reading status for this book',
    source: 'user',
    options: ['Unread', 'Currently Reading', 'Read', 'Did Not Finish'],
  },
  {
    key: 'completedDate',
    label: 'Date Completed',
    type: 'text',
    category: 'user',
    description: 'Date you finished reading this book',
    source: 'user',
  },
  {
    key: 'readCount',
    label: 'Read Count',
    type: 'number',
    category: 'user',
    description: 'Number of times you have read this book',
    source: 'user',
  },
  {
    key: 'notes',
    label: 'Personal Notes',
    type: 'textarea',
    category: 'user',
    description: 'Your private notes about this book',
    source: 'user',
  },

  // ===== METADATA =====
  {
    key: 'dataSources',
    label: 'Data Sources',
    type: 'array',
    category: 'metadata',
    description: 'APIs that provided this data',
  },
  {
    key: 'lastUpdated',
    label: 'Last Updated',
    type: 'text',
    category: 'metadata',
  },
]

// Helper function to get fields by category
export function getFieldsByCategory(category: CategoryKey): FieldConfig[] {
  return FIELD_DEFINITIONS.filter(field => field.category === category)
}

// Helper function to get category config
export function getCategoryConfig(category: CategoryKey): CategoryConfig | undefined {
  return FIELD_CATEGORIES.find(cat => cat.key === category)
}

// Default fields to show in the main form
export const DEFAULT_MAIN_FIELDS: (keyof Book)[] = [
  'title',
  'subtitle',
  'author',
  'isbn',
  'description',
  'publisher',
  'publishedDate',
  'pageCount',
  'language',
  'coverImageUrl',
]
