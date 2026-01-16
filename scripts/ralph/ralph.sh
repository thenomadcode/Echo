#!/bin/bash
# Ralph Wiggum for OpenCode - Long-running AI agent loop
# Adapted from https://github.com/snarktank/ralph
# Usage: ./ralph.sh [max_iterations]

set -e

MAX_ITERATIONS=${1:-10}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
  
  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    DATE=$(date +%Y-%m-%d)
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"
    
    echo -e "${YELLOW}Archiving previous run: $LAST_BRANCH${NC}"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo -e "${GREEN}   Archived to: $ARCHIVE_FOLDER${NC}"
    
    # Reset progress file for new run
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

# Check dependencies
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed.${NC}"
  echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
fi

if ! command -v opencode &> /dev/null; then
  echo -e "${RED}Error: opencode CLI is required but not installed.${NC}"
  exit 1
fi

# Show current PRD status
echo ""
echo -e "${BLUE}PRD Status:${NC}"
TOTAL=$(jq '.userStories | length' "$PRD_FILE" 2>/dev/null || echo "0")
DONE=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null || echo "0")
REMAINING=$((TOTAL - DONE))
echo -e "  Total stories: $TOTAL"
echo -e "  Completed: ${GREEN}$DONE${NC}"
echo -e "  Remaining: ${YELLOW}$REMAINING${NC}"
echo ""

echo -e "${GREEN}Starting Ralph - Max iterations: $MAX_ITERATIONS${NC}"
echo -e "${BLUE}Working directory: $PROJECT_ROOT${NC}"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Ralph Iteration $i of $MAX_ITERATIONS${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  
  # Check remaining stories before running
  REMAINING=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo "0")
  if [ "$REMAINING" -eq 0 ]; then
    echo ""
    echo -e "${GREEN}All stories already complete!${NC}"
    exit 0
  fi
  
  NEXT_STORY=$(jq -r '[.userStories[] | select(.passes == false)] | sort_by(.priority) | .[0] | "\(.id): \(.title)"' "$PRD_FILE" 2>/dev/null || echo "unknown")
  NEXT_STORY_ID=$(jq -r '[.userStories[] | select(.passes == false)] | sort_by(.priority) | .[0].id' "$PRD_FILE" 2>/dev/null || echo "")
  echo -e "${YELLOW}Next story: $NEXT_STORY${NC}"
  echo ""

  # Check if current story needs ultrawork mode
  ULTRWORK=$(jq -r "[.userStories[] | select(.id == \"$NEXT_STORY_ID\")][0].ultrawork" "$PRD_FILE" 2>/dev/null || echo "false")

  # Run opencode with the ralph prompt (wrapped in ultrawork tags if needed)
  cd "$PROJECT_ROOT"
  if [ "$ULTRWORK" = "true" ]; then
    PROMPT="<ultrawork>
$(cat $SCRIPT_DIR/prompt.md)
</ultrawork>"
    echo -e "${YELLOW}Ultrawork mode enabled for this story${NC}"
  else
    PROMPT=$(cat $SCRIPT_DIR/prompt.md)
  fi

  OUTPUT=$(opencode run "$PROMPT" 2>&1 | tee /dev/stderr) || true
  
  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo -e "${GREEN}══════════════════════════════════════════════════════=${NC}"
    echo -e "${GREEN}  Ralph completed all tasks!${NC}"
    echo -e "${GREEN}  Completed at iteration $i of $MAX_ITERATIONS${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════=${NC}"
    exit 0
  fi
  
  # Show updated status
  DONE=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null || echo "0")
  REMAINING=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo "0")
  echo ""
  echo -e "${BLUE}Status after iteration $i: ${GREEN}$DONE done${NC}, ${YELLOW}$REMAINING remaining${NC}"
  
  echo "Iteration $i complete. Continuing in 3 seconds..."
  sleep 3
done

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════=${NC}"
echo -e "${YELLOW}  Ralph reached max iterations ($MAX_ITERATIONS)${NC}"
echo -e "${YELLOW}  Check progress.txt for status.${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════=${NC}"
exit 1
