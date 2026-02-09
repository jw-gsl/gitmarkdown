#!/bin/bash
# =============================================================================
# Generate promo video music using WaveSpeed AI (MiniMax Music 2.5)
# Usage: ./generate-music.sh
# Requires: WAVESPEED_API_KEY in ../.env.local or as environment variable
# =============================================================================

set -e

# Load API key from .env.local if not already set
if [ -z "$WAVESPEED_API_KEY" ]; then
  if [ -f "../.env.local" ]; then
    WAVESPEED_API_KEY=$(grep '^WAVESPEED_API_KEY=' ../.env.local | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "$WAVESPEED_API_KEY" ]; then
  echo "Error: WAVESPEED_API_KEY is not set."
  echo "Add it to ../.env.local or export it as an environment variable."
  exit 1
fi

echo "Submitting music generation request to WaveSpeed AI..."

# Submit the music generation request
RESPONSE=$(curl -s -X POST "https://api.wavespeed.ai/api/v3/minimax/music-2.5" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WAVESPEED_API_KEY" \
  -d '{
    "bitrate": 256000,
    "sample_rate": 44100,
    "prompt": "Cinematic orchestral, epic, hans zimmer style, motivational, building tension, heavy war drums, strings, brass section, heroic, triumphant, emotional crescendo, wide soundstage, 8k audio quality, electronic hybrid, modern tech, pulsing synths, dramatic build, 24 seconds duration.",
    "lyrics": "(Epic orchestral intro with pulsing drums)\n\n(Verse)\nWrite the vision\nShape the dream\nEvery word\nA building beam\n\n(Chorus)\nWe rise\nWe build\nWe ship tonight\nCode and words\nBurning bright\n\n(Bridge)\nAI whispers\nGuiding hands\n\n(Outro)\nGit Markdown\nStart writing today"
  }')

echo "Response: $RESPONSE"

# Extract request ID (may be at top level or nested in data)
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rid = d.get('id') or (d.get('data', {}).get('id'))
print(rid or '')
" 2>/dev/null)

if [ -z "$REQUEST_ID" ]; then
  echo "Error: Failed to get request ID from response."
  echo "Full response: $RESPONSE"
  exit 1
fi

echo "Request ID: $REQUEST_ID"
echo "Polling for result..."

# Poll for completion
MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  sleep 5

  RESULT=$(curl -s -X GET "https://api.wavespeed.ai/api/v3/predictions/$REQUEST_ID/result" \
    -H "Authorization: Bearer $WAVESPEED_API_KEY")

  STATUS=$(echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d.get('status') or d.get('data', {}).get('status', 'unknown')
print(s)
" 2>/dev/null)

  echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS - Status: $STATUS"

  if [ "$STATUS" = "completed" ]; then
    # Get the output URL from the result or from the result endpoint
    OUTPUT_URL=$(echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
outputs = data.get('outputs', [])
print(outputs[0] if outputs else '')
" 2>/dev/null)

    if [ -z "$OUTPUT_URL" ]; then
      RESULT_DATA=$(curl -s -X GET "https://api.wavespeed.ai/api/v3/predictions/$REQUEST_ID/result" \
        -H "Authorization: Bearer $WAVESPEED_API_KEY")
      echo "  Result endpoint response: $RESULT_DATA"
      OUTPUT_URL=$(echo "$RESULT_DATA" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
outputs = data.get('outputs', [])
print(outputs[0] if outputs else '')
" 2>/dev/null)
    fi

    if [ -z "$OUTPUT_URL" ]; then
      echo "Error: Completed but no output URL found."
      echo "Result: $RESULT"
      exit 1
    fi

    echo "Downloading music..."
    curl -s -o "out/music.mp3" "$OUTPUT_URL"
    echo "Music saved to out/music.mp3"

    # Combine video and music with ffmpeg
    echo "Combining video and music..."
    ffmpeg -y -i out/promo.mp4 -i out/music.mp3 \
      -c:v copy -c:a aac -b:a 192k \
      -map 0:v:0 -map 1:a:0 \
      -shortest \
      out/promo-with-music.mp4 2>/dev/null

    echo "Done! Output: out/promo-with-music.mp4"

    # Copy to project root
    cp out/promo-with-music.mp4 ../promo.mp4
    echo "Copied to project root: ../promo.mp4"
    exit 0
  fi

  if [ "$STATUS" = "failed" ]; then
    echo "Error: Music generation failed."
    echo "Result: $RESULT"
    exit 1
  fi
done

echo "Error: Timed out waiting for music generation (max $MAX_ATTEMPTS attempts)."
exit 1
