#!/bin/bash

# Script to decrypt PDFs with "(Encrypted)" in their filename
# Usage: ./decrypt_pdfs.sh [password]

PASSWORD="$1"
BASE_DIR="/Users/scotts/src/enex-pdf-extract/out"

# Find all PDFs with "(Encrypted)" in the name
find "$BASE_DIR" -type f -name "*(Encrypted)*.pdf" -o -name "*(Encrypted)*.PDF" | while read -r encrypted_file; do
    # Create output filename by removing "(Encrypted)" from the name
    decrypted_file="${encrypted_file// (Encrypted)/}"
    
    echo "Processing: $(basename "$encrypted_file")"
    
    # Try to decrypt
    if [ -n "$PASSWORD" ]; then
        # With password
        error_output=$(qpdf --password="$PASSWORD" --decrypt "$encrypted_file" "$decrypted_file" 2>&1)
        exit_code=$?
    else
        # Without password (in case it's not actually encrypted)
        error_output=$(qpdf --decrypt "$encrypted_file" "$decrypted_file" 2>&1)
        exit_code=$?
    fi
    
    # Check if decryption succeeded by verifying the output file exists and is valid
    if [ $exit_code -eq 0 ] && [ -f "$decrypted_file" ]; then
        # Verify it's a valid PDF by checking if qpdf can read it
        if qpdf --check "$decrypted_file" >/dev/null 2>&1; then
            echo "  ✓ Decrypted: $(basename "$decrypted_file")"
            # Remove the encrypted file after successful decryption
            rm "$encrypted_file"
            echo "  ✓ Removed encrypted file: $(basename "$encrypted_file")"
        else
            echo "  ✗ Decrypted file appears invalid: $(basename "$decrypted_file")"
            # Remove the invalid output file
            [ -f "$decrypted_file" ] && rm "$decrypted_file"
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
        # Remove the failed output file if it was created
        [ -f "$decrypted_file" ] && rm "$decrypted_file"
    fi
    echo ""
done

echo "Done!"
