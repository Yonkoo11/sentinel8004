#!/usr/bin/env bash
# Generate ElevenLabs audio per clip, normalize to 48kHz stereo.
set -e
cd "$(dirname "$0")"
VOICE="nPczCjzI2devNBz1zQrb"  # Brian
KEY="$ELEVENLABS_API_KEY"
mkdir -p audio

gen() {
  local id="$1"; shift
  local text="$1"
  echo "  -> $id"
  curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE}" \
    -H "xi-api-key: ${KEY}" -H "Content-Type: application/json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"text":sys.argv[1],"model_id":"eleven_multilingual_v2","voice_settings":{"stability":0.82,"similarity_boost":0.75,"style":0.02,"use_speaker_boost":True}}))' "$text")" \
    -o "audio/${id}.mp3"
  # normalize loudness, force 48k stereo (QuickTime-safe)
  ffmpeg -y -loglevel error -i "audio/${id}.mp3" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -ac 2 "audio/${id}.wav"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "audio/${id}.wav")
  echo "     dur=${dur}s"
}

gen c1 "9,400 agents are registered on Celo. Sentinel8004 scored every single one, and most of them failed."
gen c2 "Anyone can register an agent, and nobody checks the quality. One address alone mass-registered 6,934 of them to flood the registry."
gen c3 "Every score is written on-chain to the ReputationRegistry, backed by an IPFS evidence report. 3,541 are already live on Celo mainnet."
gen c4 "Each agent is scored 0 to 100 across five deterministic layers. No LLM, no randomness. Circuit breakers cap the cheaters at 15."
gen c5 "Search the mass-registration flag, and the clone army falls out. Thousands of agents from one owner, every one capped at 15."
gen c6 "Sentinel8004. The trust layer for Celo's agents."

echo "Durations:"
for f in audio/c*.wav; do printf "%s " "$f"; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"; done
