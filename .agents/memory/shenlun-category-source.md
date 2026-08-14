---
name: 申论分类词表
description: The source-of-truth rule for the civil-service essay material classifier.
---

The user-provided `categories.json` is the authoritative classification vocabulary. It defines the five dimensions, eight themes, directions, and allowed keywords. The AI prompt and UI selectors must not invent or substitute a simplified taxonomy.

**Why:** A first frontend draft introduced a simplified example taxonomy that looked plausible but contradicted the user's controlled vocabulary, which would make saved classifications inconsistent with the intended product.

**How to apply:** Whenever the classification file changes, update the AI prompt and selector/normalization logic together, then verify IDs and names against the official JSON before presenting the app.