# Form validation

The schema is the contract — write it once, use it on both sides.

---
## Rules

1. Define the zod schema once; the client validates for UX, the server re-validates for truth.
2. Validation errors render inline next to their field, with the message from the schema — not a generic toast.
3. Submit buttons disable while pending and show progress; double-submits are impossible by construction.
4. Server failures map back onto the form (field errors where identifiable) instead of vanishing.
5. Never trust pre-filled values from the URL/body — they pass through the same schema as fresh input.
