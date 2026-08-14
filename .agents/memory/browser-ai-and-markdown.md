---
name: 浏览器直连 AI 与导出
description: The user's chosen deployment model for AI analysis and Markdown export.
---

For this personal tool, AI analysis is intentionally initiated from the static browser page using a user-entered OpenAI-compatible endpoint, API Key, and model. The page should not depend on the server-side analysis route for its main workflow. Keep these settings in `sessionStorage`, not persistent storage, so closing the tab clears the Key.

The Markdown download must follow the user's uploaded template structure, including YAML front matter and the sections for original material, AI analysis, and personal processing. Keep the export available both before saving and from saved material cards.

**Why:** The user wants to bring their own compatible service credentials and avoid exposing a project-owned Key, while using the exported files in an Obsidian-style workflow.

**How to apply:** Keep the browser-only warning visible, store settings only for the current tab, surface CORS/provider errors clearly, and treat the uploaded template as the export contract.