## enex-pdf-extract

This project is a small toolkit to help migrate PDF attachments out of Evernote `.enex` export files and into Apple Notes on macOS. It started as a one‑off “leave Evernote” project and has evolved into something **quite specific to my own export structure, filesystem layout, and Apple Notes setup**, rather than a polished, general‑purpose tool.

Among the pieces, **the `.enex` PDF extraction (`extract-pdfs.js`) is the most general and portable part**—it should be relatively easy to adapt to other environments or targets. The Apple Notes import and decryption helpers are much more tailored to my personal workflow and macOS setup.

---

## What it does

- **Extract PDFs from Evernote exports (most portable part)**
  - `extract-pdfs.js` parses Evernote `.enex` files and:
    - Creates an `out/<notebook-name>/` directory for each `.enex` file.
    - Extracts notes whose `mime` is `application/pdf`.
    - Decodes the base64 data and writes PDF files to the notebook directory.
    - Uses the Evernote `file-name` if available, otherwise falls back to the note title plus `.pdf`.
    - De‑duplicates by filename and file size so re‑runs don’t create duplicate copies.
  - This logic:
    - Is based purely on the Evernote `.enex` XML.
    - Uses `sax` for streaming parsing of large files.
    - Does **not** depend on macOS or Apple Notes.
  - **If you’re looking for something reusable, this is the piece to start from.**

- **Decrypt encrypted PDFs (qpdf‑based helpers, opinionated paths)**
  - `decrypt_pdfs.sh`:
    - Looks for PDFs under `out/` whose names contain `"(Encrypted)"` or `"(Encrypted)".PDF`.
    - Uses `qpdf` (with or without a password argument) to decrypt them.
    - Writes a new file with `"(Encrypted)"` removed from the name.
    - Verifies the decrypted PDF and, on success, removes the original encrypted file.
  - `decrypt_pdfs_check.sh`:
    - Scans **all** PDFs under `out/` using `qpdf --is-encrypted`.
    - For encrypted files, renames `<name>.pdf` → `<name>-encrypted.pdf`, decrypts back to the original name, verifies, then deletes the `-encrypted` copy.
  - Both scripts assume:
    - `qpdf` is installed and on your `PATH`.
    - The base directory is hard‑coded as `/Users/scotts/src/enex-pdf-extract/out`.
  - These are **more personal and environment‑specific**; expect to edit paths and behavior if you reuse them.

- **Import PDFs into Apple Notes with folder structure (macOS‑specific, very personal)**
  - `import-to-notes.js` is a Node CLI that:
    - Recursively walks a **source** directory of PDFs (e.g. the `out/` tree produced by `extract-pdfs.js`).
    - For each file, computes a relative path (e.g. `Notebook/Subfolder/file.pdf`).
    - Uses two AppleScript helpers to mirror that folder structure in Apple Notes (under the `iCloud` account) and create notes with the PDFs attached.
    - Moves successfully imported files into a **completed** directory while preserving subfolder structure.
  - This part is tightly coupled to:
    - macOS and the Notes app (`osascript`).
    - An iCloud Notes account (`account "iCloud"`).
    - My own desired folder hierarchy that mirrors the filesystem structure.
  - Treat it as an example of scripting Apple Notes, not as a generic importer.

---

## Opinionated / personal aspects

This codebase reflects **my own migration journey from Evernote to Apple Notes**, so it makes several assumptions:

- **Hard‑coded paths and layout**
  - Shell scripts assume the repository lives at `/Users/scotts/src/enex-pdf-extract`.
  - Extracted PDFs are expected in the `out/` directory under that repo.
  - Completed/processed files are moved into a sibling `completed` directory by `import-to-notes.js`.

- **Evernote export shape**
  - `extract-pdfs.js` expects Evernote `.enex` files with:
    - `note` elements that include `data`, `mime`, `title`, and optionally `file-name`.
  - It is tuned specifically for PDF attachments (`mime === "application/pdf"`); other attachments or content are intentionally ignored.
  - **This piece is reasonably generic** if your `.enex` files follow the same schema.

- **Apple Notes structure & account**
  - `create-folder.applescript` and `create-note.applescript` are hard‑wired to `account "iCloud"` in Notes.
  - Folder hierarchies in Notes are derived directly from the filesystem layout under `out/`.

Because of these choices, you should treat this repo as **a reference implementation of one person’s Evernote exit**, with the `.enex` PDF extraction being the most reusable component.

---

## Components

### Node scripts

- **`extract-pdfs.js` (general/portable)**
  - Uses `sax` for streaming XML parsing of `.enex` files.
  - Creates `out/<notebook-name>/` folders and writes PDFs there.
  - Skips duplicate files by comparing sizes when filenames clash.
  - Example usage:
    ```bash
    # After npm install, from the repo root
    parallel node extract-pdfs.js {} ::: "$DESKTOP/export/done/"*.enex
    ```
- **`import-to-notes.js` (macOS + Apple Notes specific)**
  - CLI options:
    - `--source <dir>`: required; root of PDFs to import.
    - `--completed <dir>`: optional; where processed files are moved (default: a `completed` directory adjacent to `--source`).
    - `--delay <seconds>`: delay between creating notes to avoid overloading Notes (default: `60`).
    - `--batch-size <number>`: number of files processed per batch before prompting (default: `20`).
  - Example usage:
    ```bash
    node import-to-notes.js \
      --source ./out \
      --completed ./out-completed \
      --delay 45 \
      --batch-size 10
    ```

### AppleScripts (Apple Notes automation)

- **`create-folder.applescript`**
  - Given a folder path like `Notebook/Subfolder`, walks/creates that hierarchy under `account "iCloud"` in Notes.
  - Handles the case where folders already exist vs. need to be created.
- **`create-note.applescript`**
  - Creates a note with a given title and attaches a file.
  - If a non‑empty folder path is provided, it navigates/creates that path in the `iCloud` account first, then creates the note there.

### Shell helpers (qpdf, path‑specific)

- **`decrypt_pdfs.sh`**
  - Targets files named like `*(Encrypted)*.pdf` under `out/`.
  - Decrypts them (using an optional password), verifies the result, and removes the encrypted original.
- **`decrypt_pdfs_check.sh`**
  - Scans all PDFs under `out` with `qpdf --is-encrypted`.
  - For encrypted files:
    - Renames `<name>.pdf` → `<name>-encrypted.pdf`.
    - Decrypts back to `<name>.pdf`.
    - Verifies and deletes the `-encrypted` file on success.

---

## Dependencies

- **Node / npm**
  - `sax` (from `package.json`):
    - Streaming XML parser for handling `.enex` files without loading them fully into memory.
- **System tools**
  - `node` and `npm`.
  - `qpdf` (e.g. via Homebrew: `brew install qpdf`).
  - `parallel` (GNU parallel) if you want to use the parallel extraction example.
  - macOS with:
    - The Notes app.
    - `osascript` (AppleScript runtime).
    - An iCloud account configured in Notes.

---

## Setup

1. **Clone and install Node dependencies**
   ```bash
   git clone <this-repo>
   cd enex-pdf-extract
   npm install
   ```

2. **Install system tools**
   - Install `qpdf`:
     ```bash
     brew install qpdf
     ```
   - Optionally install GNU `parallel`:
     ```bash
     brew install parallel
     ```
   - Ensure you are on macOS with Notes and iCloud enabled.

3. **Adjust hard‑coded paths (recommended)**
   - In `decrypt_pdfs.sh` and `decrypt_pdfs_check.sh`, update `BASE_DIR` to match where your `out` directory actually lives.
   - If you move the repo or rename the project directory, review the shell scripts for any absolute paths.
   - If you adapt the Apple Notes workflow, update the account name or folder handling in the AppleScripts as needed.

---

## Typical workflow (my personal migration flow)

1. **Export notebooks from Evernote**  
   Export notebooks as `.enex` files (for me, into `$DESKTOP/export/done/`).

2. **Extract PDFs (most portable step)**
   ```bash
   parallel node extract-pdfs.js {} ::: "$DESKTOP/export/done/"*.enex
   ```
   This populates `out/<notebook-name>/...` with PDFs.

3. **Detect & decrypt encrypted PDFs (optional, personal scripts)**
   ```bash
   # Automatically detect encrypted PDFs and decrypt them in place
   ./decrypt_pdfs_check.sh "your-password"

   # Or, if you already labeled encrypted files with "(Encrypted)" manually:
   ./decrypt_pdfs.sh "your-password"
   ```

4. **Import PDFs into Apple Notes (macOS + Notes only)**
   ```bash
   node import-to-notes.js --source ./out
   ```
   The script processes files in batches, waits between notes (configurable via `--delay`), and moves imported files into a `completed` directory.

---

## Adapting this for your own journey

- **Start with `extract-pdfs.js`**
  - This is the most self‑contained and platform‑independent part if you just want to get PDFs out of `.enex` files.
  - You can reuse it with a different output layout or feed it into another system (not necessarily Apple Notes).

- **Expect to customize everything else**
  - Paths and naming conventions in the shell scripts.
  - AppleScripts’ account and folder logic for your Notes setup.
  - `import-to-notes.js` if you want to target a different notes app, another storage system, or a different organizational scheme.

- **Test on a small subset first**
  - Before running against your full Evernote archive, try this on a handful of `.enex` files to confirm behavior and adjust to your preferences.

This project is intentionally **biased toward my own “leave Evernote” story**; think of it as a working example you can fork and tweak rather than a drop‑in migration solution.

