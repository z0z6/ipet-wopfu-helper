#!/usr/bin/env python3
"""Przygotowanie projektu Android po `npx cap add android`:
ikony aplikacji z build/icon.png, uprawnienie do aparatu (zdjęcia orzeczeń),
blokada kopii zapasowej w chmurze Google (dane uczniów zostają na urządzeniu)."""
import os, re, shutil, sys
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = os.path.join(root, 'android', 'app', 'src', 'main', 'res')
src = Image.open(os.path.join(root, 'build', 'icon.png')).convert('RGBA')

sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for d, px in sizes.items():
    folder = os.path.join(res, f'mipmap-{d}')
    os.makedirs(folder, exist_ok=True)
    icon = src.resize((px, px), Image.LANCZOS)
    for name in ('ic_launcher.png', 'ic_launcher_round.png'):
        icon.save(os.path.join(folder, name))
    fg = Image.new('RGBA', (int(px * 2.25), int(px * 2.25)), (0, 0, 0, 0))
    inner = src.resize((int(px * 1.5), int(px * 1.5)), Image.LANCZOS)
    fg.paste(inner, ((fg.width - inner.width) // 2, (fg.height - inner.height) // 2), inner)
    fg.save(os.path.join(folder, 'ic_launcher_foreground.png'))
# ikona adaptacyjna niepotrzebna – używamy pełnej ikony
shutil.rmtree(os.path.join(res, 'mipmap-anydpi-v26'), ignore_errors=True)

manifest = os.path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
m = open(manifest, encoding='utf-8').read()
if 'android.permission.CAMERA' not in m:
    m = m.replace('<uses-permission android:name="android.permission.INTERNET" />',
                  '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />')
m = re.sub(r'android:allowBackup="true"', 'android:allowBackup="false"', m)
open(manifest, 'w', encoding='utf-8').write(m)
print('android-setup: ikony, uprawnienia i allowBackup=false gotowe')
