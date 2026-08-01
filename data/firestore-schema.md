# Firestore Database Schema

## Collection: `site_content`
This collection holds the dynamic content sections for the website portfolio.

- **Document: `hero`**
  - Fields: 
    - `description` (string)
    - `photoUrl` (string)

- **Document: `thinking`**
  - Fields:
    - `array` of objects containing:
      - `title` (string)
      - `url` (string)
      - `date` (string)

- **Document: `life`**
  - Fields:
    - `array` of objects containing:
      - `title` (string)
      - `photo` (string)
      - `description` (string)
      - `date` (string)

- **Document: `contact`**
  - Fields:
    - `array` of objects containing:
      - `label` (string)
      - `url` (string)
      - `icon` (string)

- **Document: `cv`**
  - Fields:
    - `activeVersion` (string)
    - `versions` (array of objects):
      - `label` (string)
      - `filename` (string)
      - `uploadDate` (string)
      - `storageUrl` (string)

## Collection: `snaps`
- Each document represents one snap post.
- Fields:
  - `id` (string) - e.g. "snap-ABC123"
  - `platform` (string) - "instagram" or "tiktok"
  - `url` (string)
  - `embedCode` (string) - full official embed blockquote HTML
  - `caption` (string) - optional text
  - `dateAdded` (string) - e.g. "2026-06-22"

## Collection: `admin_users`
This collection controls who has access to the CMS admin panel.
- Each document represents one team member.
- Fields:
  - `email` (string)
  - `role` (string)
  - `createdAt` (timestamp or string)
