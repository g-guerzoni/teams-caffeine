#!/bin/bash
# This script compiles the Chrome extension by creating a zip archive of the source files.

OUTPUT_ZIP="chrome.zip"
SOURCE_DIR="src"

cd "$(dirname "$0")"

rm -f "./${OUTPUT_ZIP}"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Source directory '$SOURCE_DIR' not found."
  exit 1
fi

cd "$SOURCE_DIR"

echo "Creating archive '${OUTPUT_ZIP}' from directory '$(pwd)'..."
zip -r "../${OUTPUT_ZIP}" ./*

if [ $? -eq 0 ]; then
  echo "Successfully created '${OUTPUT_ZIP}' in the project root directory."
else
  echo "Error: Failed to create zip archive."
  exit 1
fi

cd ..

echo "Build process completed."