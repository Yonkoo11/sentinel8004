#!/usr/bin/env python3
"""Assemble CDP screencast frames into a smooth motion video, honoring frame timestamps."""
import json, os, subprocess, sys

VID = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(VID, 'frames')
CL = os.path.join(VID, 'clips')
os.makedirs(CL, exist_ok=True)

manifest = json.load(open(os.path.join(F, 'manifest.json')))
segA_end = json.load(open(os.path.join(F, 'segA.json')))['end']   # home
segB_end = json.load(open(os.path.join(F, 'segB.json')))['end']   # methodology
segC_end = json.load(open(os.path.join(F, 'segC.json')))['end']   # registry money-shot
maxN = max(m['n'] for m in manifest) + 1                          # close drift -> end

MINF, MAXF = 1/30.0, 0.45  # clamp per-frame display time
SPEED = {'segB': 1.85}     # tighten the methodology scroll

def build_segment(lo, hi, out):
    frames = [m for m in manifest if lo <= m['n'] < hi]
    if not frames:
        return None
    lines = []
    for i, fr in enumerate(frames):
        path = os.path.join(F, f"f{fr['n']:05d}.jpg")
        if i < len(frames) - 1:
            d = frames[i+1]['ts'] - fr['ts']
        else:
            d = 0.3
        d = max(MINF, min(MAXF, d))
        lines.append(f"file '{path}'")
        lines.append(f"duration {d:.4f}")
    # concat demuxer needs last file repeated
    last_path = os.path.join(F, f"f{frames[-1]['n']:05d}.jpg")
    lines.append(f"file '{last_path}'")
    lst = os.path.join(CL, out + '.txt')
    open(lst, 'w').write('\n'.join(lines))
    mp4 = os.path.join(CL, out + '.mp4')
    speed = SPEED.get(out, 1.0)
    vf = f'fps=30,setpts=PTS/{speed},format=yuv420p,scale=1920:1080' if speed != 1.0 else 'fps=30,format=yuv420p,scale=1920:1080'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',lst,
                    '-vf',vf,'-c:v','libx264','-preset','medium','-crf','20',
                    mp4], check=True)
    dur = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',mp4]).strip())
    print(f"{out}: {len(frames)} frames -> {dur:.2f}s")
    return dur

dA = build_segment(0, segA_end, 'segA')
dB = build_segment(segA_end, segB_end, 'segB')
dC = build_segment(segB_end, segC_end, 'segC')
dD = build_segment(segC_end, maxN, 'segD')

# concat all four
cc = os.path.join(CL, 'concat.txt')
open(cc,'w').write('\n'.join(f"file '{os.path.join(CL,s)}.mp4'" for s in ['segA','segB','segC','segD']))
out = os.path.join(VID, 'motion.mp4')
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',cc,'-c','copy',out], check=True)
total = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',out]).strip())
print(f"\nmotion.mp4 total: {total:.2f}s")
print(json.dumps({'segA':dA,'segB':dB,'segC':dC,'segD':dD,'total':total}))
