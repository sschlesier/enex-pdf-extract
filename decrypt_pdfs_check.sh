#!/bin/bash

# Script to decrypt PDFs by detecting encryption with qpdf --is-encrypted
# Usage: ./decrypt_pdfs_check.sh [password]

PASSWORD="$1"
BASE_DIR="/Users/scotts/src/enex-pdf-extract/out"

# Find all PDFs, excluding those already marked as encrypted
# Use null-separated paths to handle filenames with spaces and special characters
while IFS= read -r -d '' pdf_file; do
    # Skip files that already have -encrypted in the name
    if [[ "$pdf_file" == *"-encrypted"* ]]; then
        continue
    fi

    # Verify file exists (find with absolute BASE_DIR returns absolute paths)
    if [ ! -f "$pdf_file" ]; then
        echo "Warning: File does not exist: $pdf_file"
        continue
    fi

    # Check if PDF is encrypted using qpdf --is-encrypted
    # Exit code 0 = encrypted, exit code 2 = not encrypted
    qpdf --is-encrypted "$pdf_file" >/dev/null 2>&1
    exit_code=$?

    if [ $exit_code -eq 0 ]; then
        # PDF is encrypted (exit code 0)
        # Proceed with decryption
        encrypted_file="${pdf_file%.*}-encrypted.${pdf_file##*.}"

        echo "Encrypted PDF detected: $(basename "$pdf_file")"
        echo "  → Renaming to: $(basename "$encrypted_file")"

        # Rename the file to add -encrypted suffix
        mv "$pdf_file" "$encrypted_file"

        if [ $? -ne 0 ]; then
            echo "  ✗ Failed to rename file"
            exit 1
        fi

        # Decrypt the file back to original name
        echo "  → Decrypting to: $(basename "$pdf_file")"

        if [ -n "$PASSWORD" ]; then
            # With password
            error_output=$(qpdf --password="$PASSWORD" --decrypt "$encrypted_file" "$pdf_file" 2>&1)
            exit_code=$?
        else
            # Without password (in case it's not password-protected)
            error_output=$(qpdf --decrypt "$encrypted_file" "$pdf_file" 2>&1)
            exit_code=$?
        fi

        # Check if decryption succeeded
        if [ $exit_code -eq 0 ] && [ -f "$pdf_file" ]; then
            # Verify it's a valid PDF by checking if qpdf can read it
            if qpdf --check "$pdf_file" >/dev/null 2>&1; then
                echo "  ✓ Decrypted: $(basename "$pdf_file")"
                # Remove the encrypted file after successful decryption
                rm "$encrypted_file"
                echo "  ✓ Removed encrypted file: $(basename "$encrypted_file")"
            else
                echo "  ✗ Decrypted file appears invalid: $(basename "$pdf_file")"
                # Remove the invalid output file
                [ -f "$pdf_file" ] && rm "$pdf_file"
                # Restore the encrypted file name
                mv "$encrypted_file" "$pdf_file"
                exit 1
            fi
        else
            # Show the actual error message
            if echo "$error_output" | grep -q "invalid password"; then
                if [ -z "$PASSWORD" ]; then
                    echo "  ✗ Password required (no password provided)"
                else
                    echo "  ✗ Invalid password"
                fi
            else
                echo "  ✗ Failed to decrypt: $(basename "$encrypted_file")"
                # Show error details (but filter out common harmless warnings)
                echo "$error_output" | grep -v "object has offset 0" | grep -v "operation succeeded with warnings" | head -2
            fi
        fi
        echo ""
    fi
done < <(find "$BASE_DIR" -type f \( -name "*.pdf" -o -name "*.PDF" \) -print0)

echo "Done!"

