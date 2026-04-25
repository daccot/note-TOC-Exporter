# note TOC Exporter v2.0.0

## Summary

This release provides a Chrome extension for generating and exporting a table of contents from note.com public articles and editor pages.

## Main features

- Supports public note.com article pages
- Supports note editor pages on editor.note.com
- Extracts headings from the current note page
- Generates TOC output as Markdown, HTML, or plain text
- Supports linked and non-linked TOC output
- Supports bullet lists and numbered lists
- Supports configurable heading levels and indentation
- Supports templates and reusable profiles
- Supports recent output history and recopy actions
- Supports popup quick actions and keyboard shortcut execution
- Stores settings locally in Chrome storage

## Permissions

- ctiveTab: access the current note page only when the user invokes the extension
- clipboardWrite: copy generated TOC output to the clipboard
- storage: save local settings, templates, profiles, and history
- scripting: inject the content script into the active supported page when executed

## Privacy

- No tracking
- No analytics
- No external API communication
- No remote code execution
- No sale or transfer of user data
- Local browser processing only

## Repository maintenance in this release

- Fixed .gitignore formatting
- Excluded local test output from Git tracking
- Updated privacy policy to match actual extension behavior
- Added release notes for GitHub Releases