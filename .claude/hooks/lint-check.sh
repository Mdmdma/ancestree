#!/bin/bash
# PreToolUse hook: Lint check for frontend JS/JSX files
# Blocks edits (exit 2) if ESLint finds errors in the file being edited

# Read tool input from stdin
INPUT=$(cat)

# Extract file_path from the JSON input
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

# If no file path found, allow the operation
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only check files under ancestree-app/src/ with .js or .jsx extension
case "$FILE_PATH" in
  */ancestree-app/src/*.js|*/ancestree-app/src/*.jsx)
    ;;
  *)
    exit 0
    ;;
esac

# Check if the file exists
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Run ESLint on the file
cd "$CLAUDE_PROJECT_DIR/ancestree-app" 2>/dev/null || exit 0

LINT_OUTPUT=$(npx eslint --no-error-on-unmatched-pattern "$FILE_PATH" 2>&1)
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
  echo "ESLint errors found in $(basename "$FILE_PATH"):" >&2
  echo "$LINT_OUTPUT" >&2
  exit 2
fi

exit 0
