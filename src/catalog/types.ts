export const CATEGORY_IDS = [
  'search-engines',
  'social-media',
  'domain-network',
  'email',
  'image-video',
  'people-search',
  'geolocation',
  'threat-intelligence',
  'metadata',
  'document-content',
  'code-repository',
  'username-tracking',
  'phone-research',
  'web-archive',
  'company-org',
  'maritime-aviation',
  'visualization',
  'news-media',
  'data-statistics',
  'privacy-security',
  'financial',
  'weather',
  'war-conflict',
  'natural-disaster',
] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

export type Opsec = 'passive' | 'active'
export type Pricing = 'free' | 'freemium' | 'paid'
export type InputKind =
  | 'query'
  | 'url'
  | 'domain'
  | 'ip'
  | 'email'
  | 'username'
  | 'phone'
  | 'name'
  | 'image'
  | 'hash'
  | 'file'
  | 'coordinates'
  | 'asn'
  | 'company'
  | 'vessel'
  | 'flight'
  | 'hash-or-url'

export interface OsintTool {
  id: string
  name: string
  category: CategoryId
  subcategory?: string
  url: string
  description: string
  tags: string[]
  opsec: Opsec
  pricing: Pricing
  inputs: InputKind[]
  notes?: string
}

export interface CategoryMeta {
  id: CategoryId
  label: string
  short: string
  description: string
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'search-engines',
    label: 'Search engines',
    short: 'Search',
    description: 'General and specialist search engines for open-web collection.',
  },
  {
    id: 'social-media',
    label: 'Social media',
    short: 'Social',
    description: 'Public posts, profiles, and platform-native search.',
  },
  {
    id: 'domain-network',
    label: 'Domain & network',
    short: 'Network',
    description: 'DNS, WHOIS, certificates, IP, ASN, and internet-wide scanning indexes.',
  },
  {
    id: 'email',
    label: 'Email',
    short: 'Email',
    description: 'Address discovery, breach checks, and mail infrastructure.',
  },
  {
    id: 'image-video',
    label: 'Image & video',
    short: 'Media',
    description: 'Reverse search, verification, and visual forensics.',
  },
  {
    id: 'people-search',
    label: 'People search',
    short: 'People',
    description: 'Public people-finder and records directories.',
  },
  {
    id: 'geolocation',
    label: 'Geolocation',
    short: 'Geo',
    description: 'Maps, imagery, street-level, and geolocation helpers.',
  },
  {
    id: 'threat-intelligence',
    label: 'Threat intelligence',
    short: 'Threat',
    description: 'Malware, URL, and indicator lookup services.',
  },
  {
    id: 'metadata',
    label: 'Metadata / file analysis',
    short: 'Meta',
    description: 'EXIF, document, and media metadata viewers.',
  },
  {
    id: 'document-content',
    label: 'Document & content intelligence',
    short: 'Docs',
    description: 'Public documents, leaks databases, and text corpora.',
  },
  {
    id: 'code-repository',
    label: 'Code & repository intelligence',
    short: 'Code',
    description: 'Source, gist, and package registry search.',
  },
  {
    id: 'username-tracking',
    label: 'Username / handle tracking',
    short: 'Handles',
    description: 'Handle availability and cross-site username lookup.',
  },
  {
    id: 'phone-research',
    label: 'Phone research',
    short: 'Phone',
    description: 'Public reverse-phone and numbering resources.',
  },
  {
    id: 'web-archive',
    label: 'Web archive & historical',
    short: 'Archive',
    description: 'Time-based copies of the public web.',
  },
  {
    id: 'company-org',
    label: 'Company & organization',
    short: 'Orgs',
    description: 'Corporate registries, filings, and ownership graphs.',
  },
  {
    id: 'maritime-aviation',
    label: 'Maritime & aviation',
    short: 'AIS/ADS-B',
    description: 'Public vessel and aircraft tracking.',
  },
  {
    id: 'visualization',
    label: 'Visualization & analysis',
    short: 'Viz',
    description: 'Link analysis, mapping, and timeline tools.',
  },
  {
    id: 'news-media',
    label: 'News & media monitoring',
    short: 'News',
    description: 'News indexes, conflict maps, and media monitoring.',
  },
  {
    id: 'data-statistics',
    label: 'Data & statistics',
    short: 'Data',
    description: 'Official statistics and open data portals.',
  },
  {
    id: 'privacy-security',
    label: 'Privacy & security tools',
    short: 'OPSEC',
    description: 'Operator hygiene, anonymity, and account-security resources.',
  },
  {
    id: 'financial',
    label: 'Financial intelligence',
    short: 'Finance',
    description: 'Sanctions, leaks, filings, and public ledgers.',
  },
  {
    id: 'weather',
    label: 'Weather intelligence',
    short: 'Wx',
    description: 'Forecast, satellite, and atmospheric visualization.',
  },
  {
    id: 'war-conflict',
    label: 'War & conflict OSINT',
    short: 'Conflict',
    description: 'Public conflict maps, casualty, and investigation outlets.',
  },
  {
    id: 'natural-disaster',
    label: 'Natural disaster intelligence',
    short: 'Hazards',
    description: 'Earthquakes, fires, storms, and humanitarian alerts.',
  },
]
