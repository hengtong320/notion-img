#!/usr/bin/env python3
"""Generate the tiny procedural WAV effects used by the vertical slice."""
from pathlib import Path
import math
import struct
import wave

SAMPLE_RATE = 44100
OUT = Path(__file__).resolve().parents[1] / "assets" / "resources" / "audio"
OUT.mkdir(parents=True, exist_ok=True)


def write(name, tones, duration=0.18, volume=0.34, decay=4.5):
    count = int(SAMPLE_RATE * duration)
    frames = []
    for index in range(count):
        t = index / SAMPLE_RATE
        envelope = math.exp(-decay * t / duration)
        sample = sum(amplitude * math.sin(2 * math.pi * frequency * t + offset)
                     for frequency, amplitude, offset in tones)
        sample = max(-1.0, min(1.0, sample * envelope * volume))
        frames.append(struct.pack("<h", int(sample * 32767)))
    with wave.open(str(OUT / f"{name}.wav"), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(b"".join(frames))


write("tap", [(620, 1, 0), (930, .25, 0)], .08, .24, 6)
write("blocked", [(150, 1, 0), (205, .45, 0)], .15, .32, 5)
write("remove", [(520, 1, 0), (780, .45, 0), (1040, .18, 0)], .19, .30, 4.2)
write("unlock", [(440, 1, 0), (660, .7, 0), (880, .35, 0)], .38, .27, 2.8)
write("win", [(392, .7, 0), (523, .8, 0), (659, .8, 0), (784, .5, 0)], .78, .24, 2.1)
print(f"Generated audio in {OUT}")
