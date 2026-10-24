#!/usr/bin/env python3
"""Download externally hosted story images into the repository and point the pages at the local copies.

Scope: stories 005 and later (October stories 001-004 are NOT touched), the collection pages and
khaledoon/assets/story-collections.js. Source links (commons.wikimedia.org/wiki/File:...) are left alone.
Images that fail validation are left on their original URL and reported.
Usage: python3 scripts/localize-external-images.py [--dry-run]
"""
import glob, hashlib, os, re, sys, time, urllib.parse, urllib.request

DRY = '--dry-run' in sys.argv
OUT_DIR = 'assets/images/stories'
UA = 'KhaledoonImageLocalizer/1.0 (https://github.com/engmohamedgamalsaad-oss/nourdeen-october-1973; educational project)'
EXT = r'(?:jpe?g|png|webp|gif)'
END = r'(?=[\s"\'<>)\\?]|$)'
URL_RE = re.compile(
    r'https://(?:upload\.wikimedia\.org/[^\s"\'<>)\\]+?\.' + EXT + END + r'|thumb\.wikimedia\.org/[^\s"\'<>)\\]+?\.' + EXT + END +
    r'|commons\.wikimedia\.org/wiki/Special:FilePath/[^\s"\'<>)\\?]+|images\.metmuseum\.org/[^\s"\'<>)\\]+?\.' + EXT + END +
    r'|collectionapi\.metmuseum\.org/api/collection/\d+/iiif/\d+/main-image|images-assets\.nasa\.gov/[^\s"\'<>)\\]+?\.' + EXT + END + r'|www\.nasa\.gov/wp-content/[^\s"\'<>)\\]+?\.' + EXT + END + r')(?:\?[^\s"\'<>)\\]*)?',
    re.I)

def targets():
    files = []
    for f in sorted(glob.glob('stories/*/[0-9][0-9][0-9]/index.html')):
        if f.startswith('stories/october/'):
            continue
        files.append(f)
    files += sorted(glob.glob('khaledoon/collections/*.html'))
    if os.path.exists('khaledoon/assets/story-collections.js'):
        files.append('khaledoon/assets/story-collections.js')
    return files

def local_name(url):
    path = urllib.parse.unquote(urllib.parse.urlparse(url).path)
    base = os.path.basename(path)
    if re.search(r'/thumb/', path):          # keep the size prefix, e.g. 500px-Name.jpg
        base = os.path.basename(path)
    stem, ext = os.path.splitext(base)
    ext = ext.lower() or '.jpg'
    if re.search(r'[^\x00-\x7f]', stem):
        safe = ''
    else:
        safe = re.sub(r'[^A-Za-z0-9._-]+', '_', stem).strip('._')
    if len(safe) < 3:
        safe = 'img-' + hashlib.sha1(url.encode()).hexdigest()[:10]
    # the query string (e.g. ?width=1200) changes the bytes, so it must change the name
    if urllib.parse.urlparse(url).query:
        safe += '-' + hashlib.sha1(urllib.parse.urlparse(url).query.encode()).hexdigest()[:6]
    return safe + ext

def magic_ok(data):
    return (data[:2] == b'\xff\xd8' or data[:8] == b'\x89PNG\r\n\x1a\n' or data[:4] == b'RIFF' and data[8:12] == b'WEBP'
            or data[:6] in (b'GIF87a', b'GIF89a'))

def download(url, dest):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 1000 or not magic_ok(data):
                raise ValueError('not a valid image (%d bytes)' % len(data))
            with open(dest, 'wb') as fh:
                fh.write(data)
            return len(data)
        except Exception as e:  # noqa
            err = e
            time.sleep(3 * (attempt + 1))
    raise err

def main():
    files = targets()
    found = {}
    for f in files:
        text = open(f, encoding='utf-8').read()
        for m in URL_RE.finditer(text):
            found.setdefault(m.group(0), set()).add(f)
    print('files scanned:', len(files), '| distinct external image URLs:', len(found))
    os.makedirs(OUT_DIR, exist_ok=True)
    used, mapping, failed = {}, {}, []
    for url in sorted(found):
        name = local_name(url)
        if name in used and used[name] != url:
            name = 'img-' + hashlib.sha1(url.encode()).hexdigest()[:10] + os.path.splitext(name)[1]
        used[name] = url
        dest = os.path.join(OUT_DIR, name)
        if DRY:
            print('  would fetch', url[:100], '->', dest); mapping[url] = name; continue
        try:
            if not os.path.exists(dest):
                size = download(url, dest); print('  ok  %8d B  %s' % (size, dest))
                time.sleep(1.5)
            mapping[url] = name
        except Exception as e:  # noqa
            failed.append((url, str(e))); print('  FAIL', url[:100], '-', e)
    changed = 0
    for f in files:
        text = open(f, encoding='utf-8').read(); new = text
        for url in sorted(found, key=len, reverse=True):
            if url not in mapping or f not in found[url]:
                continue
            name = mapping[url]
            if f.endswith('.js'):
                new = re.sub(r"(['\"])" + re.escape(url) + r"\1", "root + '" + os.path.join(OUT_DIR, name).replace('\\', '/') + "'", new)
            else:
                rel = os.path.relpath(os.path.join(OUT_DIR, name), os.path.dirname(f)).replace('\\', '/')
                new = new.replace(url, rel)
        if new != text:
            changed += 1
            if not DRY:
                open(f, 'w', encoding='utf-8', newline='').write(new)
            print('  rewrote', f)
    if not DRY:
        with open(os.path.join(OUT_DIR, 'MANIFEST.md'), 'w', encoding='utf-8') as fh:
            fh.write('# Locally hosted story images\n\nEach file was downloaded unmodified from the original URL below. '
                     'Credits and licences stay in each story page and its sources.md.\n\n| Local file | Original URL | Used by |\n|---|---|---|\n')
            for url, name in sorted(mapping.items(), key=lambda x: x[1]):
                fh.write('| `%s` | %s | %s |\n' % (name, url, ', '.join(sorted(found[url]))))
    print('summary: %d images, %d files rewritten, %d failed' % (len(mapping), changed, len(failed)))
    if failed:
        print('FAILED (left on their original URL):'); [print('  -', u, '|', e) for u, e in failed]
    sys.exit(0)

main()
