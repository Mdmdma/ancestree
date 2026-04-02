#!/bin/bash
# PostToolUse hook: Syntax check for backend JS files
# Blocks (exit 2) if Node.js finds syntax errors in the edited file

# Read tool input from stdin
INPUT=$(cat)

# Extract file_path from the JSON input
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

# If no file path found, allow
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only check .js files under ancestree-backend/
case "$FILE_PATH" in
  */ancestree-backend/*.js)
    ;;
  *)
    exit 0
    ;;
esac

# Check if the file exists
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Run Node.js syntax check
SYNTAX_OUTPUT=$(node --check "$FILE_PATH" 2>&1)
SYNTAX_EXIT=$?

if [ $SYNTAX_EXIT -ne 0 ]; then
  echo "Syntax error in $(basename "$FILE_PATH"):" >&2
  echo "$SYNTAX_OUTPUT" >&2
  exit 2
fi

exit 0
