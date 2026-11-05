# Security policy

Code Archaeologist reads git history locally and writes static HTML. A few things are
worth knowing:

- **Generated pages** embed commit subjects, author names and file paths. They never embed
  email addresses or source code. All embedded data is escaped so it cannot break out of the
  page's `<script>` element.
- **AI narration** is opt-in by environment variable. Only an aggregate digest (statistics,
  names, paths, milestone commit subjects) is sent to the selected provider.
- **Remote URLs** passed to the CLI are cloned with your local `git` into a temporary directory.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting on this repository
(Security → Report a vulnerability) rather than a public issue. You can expect a reply within a week.
