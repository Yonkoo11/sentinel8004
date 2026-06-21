#!/usr/bin/env python3
"""Render caption PNGs (Pillow) and composite onto motion.mp4 via ffmpeg overlay.
Caption text is byte-for-byte from VOICEOVER_CLIPS.md."""
import os, subprocess, re
from PIL import Image, ImageDraw, ImageFont

VID = os.path.dirname(os.path.abspath(__file__))
MOTION = os.path.join(VID, 'motion.mp4')
OUT = os.path.join(VID, 'sentinel8004-demo.mp4')
CAPDIR = os.path.join(VID, 'caps'); os.makedirs(CAPDIR, exist_ok=True)
W, H = 1920, 1080
FONT = '/System/Library/Fonts/HelveticaNeue.ttc'

CAPS = [
    (0.5,  9.0,  "9,400 agents are registered on Celo. Sentinel8004 scored every single one, and most of them failed."),
    (9.5,  19.0, "Anyone can register an agent, and nobody checks the quality. One address alone mass-registered 6,934 of them to flood the registry."),
    (19.3, 26.2, "Every score is written on-chain to the ReputationRegistry, backed by an IPFS evidence report. 3,541 are already live on Celo mainnet."),
    (26.6, 39.8, "Each agent is scored 0 to 100 across five deterministic layers. No LLM, no randomness. Circuit breakers cap the cheaters at 15."),
    (41.3, 56.9, "Search the mass-registration flag, and the clone army falls out. Thousands of agents from one owner, every one capped at 15."),
    (57.6, 61.0, "Sentinel8004. The trust layer for Celo's agents."),
]

# byte-for-byte verify against the script
vo = open(os.path.join(VID, 'VOICEOVER_CLIPS.md')).read()
for (_, _, t) in CAPS:
    if t not in vo:
        raise SystemExit(f"CAPTION DRIFT: not in VOICEOVER_CLIPS.md:\n  {t}")
print("caption/script match: OK")

font = ImageFont.truetype(FONT, 44, index=0)
try:
    bold = ImageFont.truetype(FONT, 46, index=1)  # HelveticaNeue Bold
except Exception:
    bold = font

def wrap_px(draw, text, fnt, maxw):
    words = text.split(); lines = []; cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=fnt) > maxw and cur:
            lines.append(cur); cur = w
        else:
            cur = trial
    if cur: lines.append(cur)
    return lines

def render(idx, text):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    maxw = 1480
    lines = wrap_px(d, text, bold, maxw)
    lh = 60
    block_h = lh * len(lines)
    y0 = 980 - block_h  # bottom-anchored lower third
    for i, ln in enumerate(lines):
        tw = d.textlength(ln, font=bold)
        x = (W - tw) / 2
        y = y0 + i * lh
        # soft shadow for legibility
        for dx, dy in [(0,2),(2,0),(2,2),(0,3)]:
            d.text((x+dx, y+dy), ln, font=bold, fill=(0, 0, 0, 180))
        d.text((x, y), ln, font=bold, fill=(255, 255, 255, 255))
    p = os.path.join(CAPDIR, f'cap{idx}.png')
    img.save(p)
    return p

pngs = [render(i, t) for i, (_, _, t) in enumerate(CAPS)]

# build ffmpeg overlay chain
inputs = ['-i', MOTION]
for p in pngs:
    inputs += ['-i', p]
fc = []
prev = '[0:v]'
for i, (a, b, _) in enumerate(CAPS):
    out = f'[v{i}]'
    fc.append(f"{prev}[{i+1}:v]overlay=0:0:enable='between(t,{a},{b})'{out}")
    prev = out
filter_complex = ";".join(fc)

cmd = ['ffmpeg','-y','-loglevel','error'] + inputs + [
    '-filter_complex', filter_complex, '-map', prev,
    '-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p',
    '-movflags','+faststart', OUT]
subprocess.run(cmd, check=True)
dur = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',OUT]).strip())
print(f"sentinel8004-demo.mp4: {dur:.2f}s")
