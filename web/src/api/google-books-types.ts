/**
 * Complete TypeScript types for Google Books API v1
 * Based on official API documentation and sample responses
 */

export interface GoogleBooksVolume {
  kind: string // "books#volume"
  id: string
  etag: string
  selfLink: string
  volumeInfo: VolumeInfo
  saleInfo?: SaleInfo
  accessInfo?: AccessInfo
  searchInfo?: SearchInfo
  userInfo?: UserInfo
  layerInfo?: LayerInfo
}

export interface VolumeInfo {
  title: string
  subtitle?: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  industryIdentifiers?: IndustryIdentifier[]
  readingModes?: ReadingModes
  pageCount?: number
  printType?: string // "BOOK" | "MAGAZINE"
  mainCategory?: string
  categories?: string[]
  averageRating?: number
  ratingsCount?: number
  maturityRating?: string
  allowAnonLogging?: boolean
  contentVersion?: string
  panelizationSummary?: PanelizationSummary
  imageLinks?: ImageLinks
  language?: string
  previewLink?: string
  infoLink?: string
  canonicalVolumeLink?: string
  dimensions?: Dimensions
  seriesInfo?: SeriesInfo
  subtitleLanguage?: string
  otherTitles?: string[]
}

export interface IndustryIdentifier {
  type: string // "ISBN_10" | "ISBN_13" | "ISSN" | "OTHER"
  identifier: string
}

export interface ReadingModes {
  text: boolean
  image: boolean
}

export interface PanelizationSummary {
  containsEpubBubbles: boolean
  containsImageBubbles: boolean
}

export interface ImageLinks {
  smallThumbnail?: string
  thumbnail?: string
  small?: string
  medium?: string
  large?: string
  extraLarge?: string
}

export interface Dimensions {
  height?: string
  width?: string
  thickness?: string
}

export interface SeriesInfo {
  kind: string // "books#series"
  seriesId?: string
  seriesName?: string
  volumeNumber?: string
}

export interface SaleInfo {
  country?: string
  saleability?: string // "FOR_SALE" | "NOT_FOR_SALE" | "FREE"
  onSaleDate?: string
  isEbook?: boolean
  listPrice?: Price
  retailPrice?: Price
  buyLink?: string
  offers?: Offer[]
}

export interface Price {
  amount?: number
  currencyCode?: string
}

export interface Offer {
  finskyOfferType?: number
  listPrice?: MicroPrice
  retailPrice?: MicroPrice
  giftable?: boolean
}

export interface MicroPrice {
  amountInMicros?: number
  currencyCode?: string
}

export interface AccessInfo {
  country?: string
  viewability?: string // "PARTIAL" | "ALL_PAGES" | "NO_PAGES" | "UNKNOWN"
  embeddable?: boolean
  publicDomain?: boolean
  textToSpeechPermission?: string
  epub?: FormatAvailability
  pdf?: FormatAvailability
  webReaderLink?: string
  accessViewStatus?: string
  quoteSharingAllowed?: boolean
  downloadAccess?: DownloadAccess
}

export interface FormatAvailability {
  isAvailable: boolean
  downloadLink?: string
  acsTokenLink?: string
}

export interface DownloadAccess {
  kind?: string // "books#downloadAccessRestriction"
  volumeId?: string
  restricted?: boolean
  deviceAllowed?: boolean
  justAcquired?: boolean
  maxDownloadDevices?: number
  downloadsAcquired?: number
  nonce?: string
  source?: string
  reasonCode?: string
  message?: string
  signature?: string
}

export interface SearchInfo {
  textSnippet?: string
}

export interface UserInfo {
  isPurchased?: boolean
  isPreordered?: boolean
  review?: Review
  readingPosition?: ReadingPosition
  updated?: string
}

export interface Review {
  kind?: string // "books#review"
  reviewer?: string
  rating?: number
  text?: string
  date?: string
}

export interface ReadingPosition {
  position?: string
  updated?: string
}

export interface LayerInfo {
  layers?: Layer[]
}

export interface Layer {
  layerId?: string
  volumeAnnotationsVersion?: string
}

export interface GoogleBooksSearchResponse {
  kind: string // "books#volumes"
  totalItems: number
  items?: GoogleBooksVolume[]
}
