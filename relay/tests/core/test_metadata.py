import base64
import io
import zlib

import pytest
from PIL import Image
from PIL.PngImagePlugin import PngInfo

from app.schemas import GeneratedImage


CONTAINERS = ('jpeg-xmp', 'jpeg-xmp-utf16', 'jpeg-exif-xmp', 'png-xmp',
              'png-xmp-compressed', 'png-xmp-after-idat', 'png-exif-xmp',
              'jpeg-xmp-duplicate', 'png-xmp-duplicate')


def xmp_image(container, *, location=True):
    property_xml = ('e:GPSLatitude="37,46.494N" e:GPSLongitude="122,25.164W"' if location else
                    'e:DateTimeOriginal="2026-11-04T10:00:00-05:00"')
    xml = ('<x:xmpmeta xmlns:x="adobe:ns:meta/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
           '<rdf:RDF><rdf:Description xmlns:e="http://ns.adobe.com/exif/1.0/" ' + property_xml +
           '/></rdf:RDF></x:xmpmeta>')
    xmp = xml.encode('utf-16' if container.endswith('utf16') else 'utf-8')
    options = {}
    if 'exif' in container:
        exif = Image.Exif()
        exif[700] = xmp
        options['exif'] = exif
    elif container.startswith('jpeg'):
        options['xmp'] = xmp
    else:
        metadata = PngInfo()
        if container.endswith('after-idat'):
            metadata.add(b'iTXt', b'XML:com.adobe.xmp\0\0\0\0\0' + xmp, after_idat=True)
        elif container.endswith('compressed'):
            metadata.add(b'iTXt', b'XML:com.adobe.xmp\0\1\0\0\0' + zlib.compress(xmp))
        else:
            metadata.add_itxt('XML:com.adobe.xmp', xml)
        if container.endswith('duplicate'):
            metadata.add_itxt('XML:com.adobe.xmp', '<metadata><creator>fixture</creator></metadata>')
        options['pnginfo'] = metadata
    stream = io.BytesIO()
    fmt = 'JPEG' if container.startswith('jpeg') else 'PNG'
    Image.new('RGB', (2, 2), (80, 120, 160)).save(stream, format=fmt, **options)
    if container == 'jpeg-xmp-duplicate':
        raw = stream.getvalue()
        start = raw.index(b'\xff\xe1')
        end = start + 2 + int.from_bytes(raw[start + 2:start + 4], 'big')
        benign = b'http://ns.adobe.com/xap/1.0/\0<metadata><creator>fixture</creator></metadata>'
        stream = io.BytesIO(raw[:end] + b'\xff\xe1' + (len(benign) + 2).to_bytes(2, 'big') + benign + raw[end:])
    return {'mimeType': 'image/jpeg' if fmt == 'JPEG' else 'image/png',
            'data': base64.b64encode(stream.getvalue()).decode(), 'width': 2, 'height': 2}


@pytest.mark.parametrize('container', CONTAINERS)
def test_upload_rejects_gps_xmp(client, container):
    response = client.post('/v1/describe/piece', json={'image': xmp_image(container)})
    assert response.status_code == 400
    assert response.json()['error']['code'] == 'invalid_request'
    assert '37,46.494' not in response.text and '122,25.164' not in response.text
    assert response.headers['cache-control'] == 'no-store'


@pytest.mark.parametrize('container', ('jpeg-xmp', 'png-xmp-after-idat'))
def test_nonlocation_xmp_remains_valid(client, container):
    response = client.post('/v1/describe/piece', json={'image': xmp_image(container, location=False)})
    assert response.status_code == 200


def test_generated_image_preserves_original_metadata_bytes():
    image = xmp_image('jpeg-xmp')
    validated = GeneratedImage.model_validate(image)
    assert validated.data == image['data']
