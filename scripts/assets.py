"""Extract original bitmap resources from the supplied SkiFree PE executable.
Uses only the Python standard library; the executable is never run or modified.
"""
import hashlib
import json
import pathlib
import struct
import zipfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def resources(data):
    u16 = lambda p: struct.unpack_from('<H', data, p)[0]
    u32 = lambda p: struct.unpack_from('<I', data, p)[0]
    pe = u32(60)
    optional = pe+24
    table = optional+u16(pe+20)
    sections = []
    for i in range(u16(pe+6)):
        p = table+i*40
        sections.append((u32(p+12), max(u32(p+8), u32(p+16)), u32(p+20)))

    def offset(rva):
        for address, size, raw in sections:
            if address <= rva < address+size:
                return raw+rva-address
        raise ValueError('Invalid resource address')

    base = offset(u32(optional+112))

    def walk(p=0, path=()):
        for i in range(u16(base+p+12)+u16(base+p+14)):
            q = base+p+16+i*8
            name, entry = u32(q), u32(q+4)
            if name & 0x80000000:
                n = base+(name & 0x7fffffff)
                name = data[n+2:n+2+u16(n)*2].decode('utf-16le')
            if entry & 0x80000000:
                yield from walk(entry & 0x7fffffff, path+(name,))
            else:
                record = base+entry
                start = offset(u32(record))
                yield path+(name,), data[start:start+u32(record+4)]
    return walk()


def bitmap(data, blue=False):
    header, width, height, planes, bits, compression = struct.unpack_from('<IiiHHI', data)
    if planes != 1 or compression != 0 or bits not in (4, 8):
        raise ValueError('Unexpected original bitmap format')
    count = struct.unpack_from('<I', data, 32)[0] or 1 << bits
    colors = []
    for i in range(count):
        b, g, r, _ = data[header+i*4:header+i*4+4]
        color = (r, g, b)
        if blue:
            color = {(255, 0, 0):(0, 164, 206), (0, 0, 255):(255, 139, 40)}.get(color, color)
        colors.append(bytes((*color, 0 if (r, g, b) == (255, 255, 255) else 255)))
    stride = (width*bits+31)//32*4
    start = header+count*4
    output = bytearray(width*abs(height)*4)
    for y in range(abs(height)):
        row = start+(abs(height)-1-y if height > 0 else y)*stride
        for x in range(width):
            value = data[row+x] if bits == 8 else (data[row+x//2] >> (0 if x % 2 else 4)) & 15
            output[(y*width+x)*4:(y*width+x+1)*4] = colors[value]
    return width, abs(height), output


def png(width, height, pixels):
    def chunk(name, value):
        return struct.pack('>I', len(value))+name+value+struct.pack('>I', zlib.crc32(name+value))
    scanlines = b''.join(b'\0'+pixels[y*width*4:(y+1)*width*4] for y in range(height))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))+chunk(b'IDAT', zlib.compress(scanlines, 9))+chunk(b'IEND', b'')


def build():
    archive = ROOT/'assets/ski32-original.zip'
    with zipfile.ZipFile(archive) as z:
        executable = z.read('ski32.exe')
    sprites = {path[1]: data for path, data in resources(executable) if path[0] == 2}
    manifest = {'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'sprites': {}}
    out = ROOT/'site/assets'
    out.mkdir(parents=True, exist_ok=True)
    for blue, filename in [(False, 'original.png'), (True, 'partner.png')]:
        width, height = 1024, 720
        pixels = bytearray(width*height*4)
        for index, (number, data) in enumerate(sorted(sprites.items())):
            w, h, sprite = bitmap(data, blue and number <= 22)
            x, y = index % 10*100, index//10*80
            for row in range(h):
                start = ((y+row)*width+x)*4
                pixels[start:start+w*4] = sprite[row*w*4:(row+1)*w*4]
            manifest['sprites'][str(number)] = {'x': x, 'y': y, 'w': w, 'h': h}
        (out/filename).write_bytes(png(width, height, pixels))
    (out/'sprites.json').write_text(json.dumps(manifest, separators=(',', ':'))+'\n')
    print(f'Extracted {len(sprites)} original SkiFree sprites; original archive preserved.')


if __name__ == '__main__':
    build()
