#!/usr/bin/env bash
APK="$1"
if [ -z "$APK" ]; then echo "usage: $0 <app-release.apk>"; exit 1; fi
set -e
echo "== list ic_launcher files =="
unzip -l "$APK" | grep -i "ic_launcher" || true
echo "== dump adaptive xml =="
unzip -p "$APK" res/mipmap-anydpi-v26/ic_launcher.xml    | sed -n '1,120p' || true
unzip -p "$APK" res/mipmap-anydpi-v26/ic_launcher_round.xml | sed -n '1,120p' || true
echo "== check foreground/background png =="
unzip -l "$APK" | grep -i "ic_launcher_foreground.png" || true
unzip -l "$APK" | grep -i "ic_launcher_background" || true
