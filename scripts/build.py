"""Small offline Android build, using the official SDK and an installed JDK.

ANDROID_SDK_ROOT and JAVA_HOME may override local tool locations.
No user account data is read or bundled.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SDK = Path(os.environ.get('ANDROID_SDK_ROOT', r'D:\Software\AndroidSDK'))
JAVA = Path(os.environ.get('JAVA_HOME', r'C:\Program Files\JetBrains\PyCharm 2026.1.4\jbr'))
TOOL_SUFFIX = '.exe' if os.name == 'nt' else ''
TOOLS = next((p for p in sorted((SDK / 'build-tools').glob('*'), reverse=True)
              if (p / ('aapt2' + TOOL_SUFFIX)).exists()), None)
PLATFORM = SDK / 'platforms' / 'android-35' / 'android.jar'
BUILD = ROOT / 'build'
DIST = ROOT / 'dist'
SRC = ROOT / 'app' / 'src' / 'main'
MANIFEST = ET.parse(SRC / 'AndroidManifest.xml').getroot()
ANDROID = '{http://schemas.android.com/apk/res/android}'
VERSION = MANIFEST.attrib[ANDROID + 'versionName']
VERSION_CODE = int(MANIFEST.attrib[ANDROID + 'versionCode'])
PACKAGE = MANIFEST.attrib['package']


def tool(name):
    return TOOLS / (name + TOOL_SUFFIX)


def run(*args):
    subprocess.run([str(a) for a in args], check=True, cwd=ROOT)


def main():
    if TOOLS is None or not PLATFORM.exists() or not (JAVA / 'bin' / ('javac' + TOOL_SUFFIX)).exists():
        raise RuntimeError('Set JAVA_HOME and ANDROID_SDK_ROOT; install platform 35 and build-tools 35.')
    for directory in [BUILD / 'classes', BUILD / 'dex', DIST, ROOT / '.tooling']:
        directory.mkdir(parents=True, exist_ok=True)
    java = JAVA / 'bin' / ('java' + TOOL_SUFFIX)
    run(tool('aapt2'), 'compile', '--dir', SRC/'res', '-o', BUILD/'resources.zip')
    run(tool('aapt2'), 'link', '-o', BUILD/'unsigned.apk', '-I', PLATFORM,
        '--manifest', SRC/'AndroidManifest.xml', '--min-sdk-version', '26',
        '--target-sdk-version', '35', '-A', SRC/'assets', BUILD/'resources.zip')
    sources = list((SRC/'java').rglob('*.java'))
    run(JAVA/'bin' / ('javac' + TOOL_SUFFIX), '--release', '8', '-encoding', 'UTF-8', '-classpath', PLATFORM,
        '-d', BUILD/'classes', *sources)
    with zipfile.ZipFile(BUILD/'classes.jar', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in (BUILD/'classes').rglob('*.class'):
            archive.write(path, path.relative_to(BUILD/'classes').as_posix())
    run(java, '-cp', TOOLS/'lib/d8.jar', 'com.android.tools.r8.D8', '--release',
        '--lib', PLATFORM, '--min-api', '26', '--output', BUILD/'dex', BUILD/'classes.jar')
    with zipfile.ZipFile(BUILD/'unsigned.apk', 'a', zipfile.ZIP_DEFLATED) as archive:
        for path in (BUILD/'dex').glob('*.dex'):
            archive.write(path, path.name)
    run(tool('zipalign'), '-P', '16', '-f', '4', BUILD/'unsigned.apk', BUILD/'aligned.apk')
    key = Path(os.environ.get('MORROW_SIGNING_KEY', ROOT/'.tooling/personal-signing.jks'))
    if not key.exists():
        raise RuntimeError('Signing key missing. Set MORROW_SIGNING_KEY to the existing private key path.')
    apk = DIST/f'Morrow-v{VERSION}-vc{VERSION_CODE}.apk'
    alias = os.environ.get('MORROW_KEY_ALIAS', 'shiji')
    os.environ.setdefault('MORROW_KEYSTORE_PASSWORD', 'android')
    os.environ.setdefault('MORROW_KEY_PASSWORD', os.environ['MORROW_KEYSTORE_PASSWORD'])
    run(java, '-jar', TOOLS/'lib/apksigner.jar', 'sign', '--ks', key, '--ks-key-alias', alias,
        '--ks-pass', 'env:MORROW_KEYSTORE_PASSWORD', '--key-pass', 'env:MORROW_KEY_PASSWORD', '--out', apk, BUILD/'aligned.apk')
    run(java, '-jar', TOOLS/'lib/apksigner.jar', 'verify', '--verbose', apk)
    run(tool('zipalign'), '-c', '-P', '16', '4', apk)
    digest = hashlib.sha256(apk.read_bytes()).hexdigest()
    (DIST/'SHA256.txt').write_text(digest+'  '+apk.name+'\n', encoding='ascii')
    (DIST/'build-info.json').write_text(json.dumps({'version':VERSION,'versionCode':VERSION_CODE,'package':PACKAGE,
        'minSdk':26,'targetSdk':35,'sha256':digest,'bytes':apk.stat().st_size},indent=2),encoding='utf-8')
    print('APK built, signature and alignment verified:', apk, flush=True)


if __name__ == '__main__':
    main()
