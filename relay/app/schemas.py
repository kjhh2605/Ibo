"""Code-first wire contracts shared by the relay and its clients."""
from __future__ import annotations

import base64
import math
import io
import struct
import zlib
from xml.etree import ElementTree
from PIL import Image as PILImage, UnidentifiedImageError
from datetime import datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic.json_schema import SkipJsonSchema
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Ref = Annotated[str, StringConstraints(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9_-]+$')]
Phrase = Annotated[str, StringConstraints(min_length=1, max_length=160, pattern=r'\S')]
Token = Annotated[str, StringConstraints(min_length=1, max_length=12582912)]
NonBlank300 = Annotated[str, StringConstraints(min_length=1, max_length=300, pattern=r'\S')]
Score = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
Coordinate = tuple[Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)], Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]]

class Wire(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)

    @model_validator(mode='before')
    @classmethod
    def no_explicit_null_for_optional_fields(cls, value):
        if isinstance(value, dict):
            for name, field in cls.model_fields.items():
                key = field.alias or name
                if key in value and value[key] is None and not field.is_required():
                    raise ValueError('Optional fields must be omitted rather than null')
        return value

class Image(Wire):
    mimeType: Literal['image/jpeg', 'image/png']
    data: Annotated[str, Field(min_length=4, max_length=5592408, json_schema_extra={'contentEncoding': 'base64'})]
    width: Annotated[int, Field(ge=1, le=2048)]
    height: Annotated[int, Field(ge=1, le=2048)]

    @model_validator(mode='after')
    def valid_data(self):
        validate_image(self.data, self.mimeType, self.width, self.height, 4194304, reject_gps=True)
        return self

class Point(Wire):
    lat: Annotated[float, Field(ge=-90, le=90)]
    lng: Annotated[float, Field(ge=-180, le=180)]

class ErrorDetail(Wire):
    code: str
    message: Annotated[str, Field(max_length=256)]
    retryable: bool

class Error(Wire):
    error: ErrorDetail

class QueryContext(Wire):
    now: AwareDatetime
    timeZone: str
    @model_validator(mode='after')
    def valid_zone(self):
        try:
            zone = ZoneInfo(self.timeZone)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError('Invalid time zone') from exc
        if self.now.utcoffset() != self.now.astimezone(zone).utcoffset():
            raise ValueError('Time zone offset mismatch')
        return self

class ListVisitsArguments(Wire):
    from_: AwareDatetime | SkipJsonSchema[None] = Field(default=None, alias='from')
    to: AwareDatetime | SkipJsonSchema[None] = None
    limit: Annotated[int, Field(ge=1, le=10000)] | SkipJsonSchema[None] = None
    @model_validator(mode='after')
    def bounds(self):
        if self.from_ and self.to and self.from_ >= self.to:
            raise ValueError('Invalid time range')
        return self

class FindPhotosArguments(Wire):
    phrase: Phrase
    shopRefs: Annotated[list[Ref], Field(min_length=1, json_schema_extra={'uniqueItems': True})] | SkipJsonSchema[None] = None
    timeFrom: AwareDatetime | SkipJsonSchema[None] = None
    timeTo: AwareDatetime | SkipJsonSchema[None] = None
    k: Annotated[int, Field(ge=1, le=3)] = 3
    @model_validator(mode='after')
    def bounds(self):
        if self.shopRefs and len(set(self.shopRefs)) != len(self.shopRefs):
            raise ValueError('Duplicate refs')
        if self.timeFrom and self.timeTo and self.timeFrom >= self.timeTo:
            raise ValueError('Invalid time range')
        return self

class ExtractItemsArguments(Wire):
    photoRefs: Annotated[list[Ref], Field(min_length=1, max_length=3, json_schema_extra={'uniqueItems': True})]
    concept: Phrase
    @field_validator('photoRefs')
    @classmethod
    def unique_refs(cls, value):
        if len(set(value)) != len(value): raise ValueError('Duplicate refs')
        return value

class VisitSummary(Wire):
    tripRef: Ref
    tripStartedAt: AwareDatetime
    tripEndedAt: AwareDatetime | SkipJsonSchema[None] = None
    tripStatus: Literal['recording', 'ended']
    shopRef: Ref
    n: Annotated[int, Field(ge=1)]
    startedAt: AwareDatetime
    descriptionState: Literal['none', 'pending', 'done', 'failed']
    description: NonBlank300 | SkipJsonSchema[None] = None
    note: Annotated[str, StringConstraints(min_length=1)] | SkipJsonSchema[None] = None
    photoCount: Annotated[int, Field(ge=0)]
    firstPhotoAt: AwareDatetime | SkipJsonSchema[None] = None
    lastPhotoAt: AwareDatetime | SkipJsonSchema[None] = None
    @model_validator(mode='after')
    def consistency(self):
        if (self.tripStatus == 'ended') != (self.tripEndedAt is not None): raise ValueError('Trip end mismatch')
        if (self.descriptionState == 'done') != (self.description is not None): raise ValueError('Description mismatch')
        if (self.photoCount > 0) != (self.firstPhotoAt is not None and self.lastPhotoAt is not None): raise ValueError('Photo times mismatch')
        if self.photoCount == 0 and (self.firstPhotoAt or self.lastPhotoAt): raise ValueError('Unexpected photo times')
        if self.startedAt < self.tripStartedAt or (self.tripEndedAt and (self.tripEndedAt < self.tripStartedAt or self.startedAt > self.tripEndedAt)): raise ValueError('Trip time order')
        if self.firstPhotoAt and (self.firstPhotoAt < self.startedAt or self.lastPhotoAt < self.firstPhotoAt or (self.tripEndedAt and self.lastPhotoAt > self.tripEndedAt)): raise ValueError('Photo time order')
        return self

class ListVisitsResult(Wire):
    visits: list[VisitSummary]
    matchingCount: Annotated[int, Field(ge=0)]
    truncated: bool
    @model_validator(mode='after')
    def consistency(self):
        if self.matchingCount < len(self.visits) or self.truncated != (len(self.visits) < self.matchingCount): raise ValueError('Count mismatch')
        return self

class FoundPhoto(Wire):
    photoRef: Ref
    shopRef: Ref
    takenAt: AwareDatetime
    score: Annotated[float, Field(ge=-1, le=1)]

class ExtractSummary(Wire):
    photoRef: Ref
    candidateCount: Annotated[int, Field(ge=0)]
    topScore: Score | None
    @model_validator(mode='after')
    def consistency(self):
        if (self.candidateCount == 0) != (self.topScore is None): raise ValueError('Score mismatch')
        return self

class ListVisitsCall(Wire):
    id: Ref
    name: Literal['list_visits']
    arguments: ListVisitsArguments
class FindPhotosCall(Wire):
    id: Ref
    name: Literal['find_photos']
    arguments: FindPhotosArguments
    phraseVector: Annotated[list[float], Field(min_length=512, max_length=512)]
    @field_validator('phraseVector')
    @classmethod
    def unit_vector(cls, value):
        if abs(math.sqrt(sum(x*x for x in value)) - 1) > 1e-5: raise ValueError('Vector is not normalized')
        return value
class ExtractItemsCall(Wire):
    id: Ref
    name: Literal['extract_items']
    arguments: ExtractItemsArguments
ToolCall = Annotated[ListVisitsCall | FindPhotosCall | ExtractItemsCall, Field(discriminator='name')]

class ListVisitsToolResult(Wire):
    toolCallId: Ref
    name: Literal['list_visits']
    result: ListVisitsResult
class FindPhotosToolResult(Wire):
    toolCallId: Ref
    name: Literal['find_photos']
    result: Annotated[list[FoundPhoto], Field(max_length=3)]
    @field_validator('result')
    @classmethod
    def unique_refs(cls, value):
        if len({v.photoRef for v in value}) != len(value): raise ValueError('Duplicate refs')
        return value
class ExtractItemsToolResult(Wire):
    toolCallId: Ref
    name: Literal['extract_items']
    result: Annotated[list[ExtractSummary], Field(min_length=1, max_length=3)]
    @field_validator('result')
    @classmethod
    def unique_refs(cls, value):
        if len({v.photoRef for v in value}) != len(value): raise ValueError('Duplicate refs')
        return value
ToolResult = Annotated[ListVisitsToolResult | FindPhotosToolResult | ExtractItemsToolResult, Field(discriminator='name')]

class Final(Wire):
    photoRefs: Annotated[list[Ref], Field(min_length=1, max_length=3, json_schema_extra={'uniqueItems': True})]
    concept: Phrase
    shopRef: Ref | SkipJsonSchema[None] = None
    summary: NonBlank300
    @field_validator('photoRefs')
    @classmethod
    def unique_refs(cls, value):
        if len(set(value)) != len(value): raise ValueError('Duplicate refs')
        return value
class NotFound(Wire):
    reason: NonBlank300
class SearchTurnRequest(Wire):
    query: Annotated[str, StringConstraints(min_length=1, max_length=2000, pattern=r'\S')]
    context: QueryContext | SkipJsonSchema[None] = None
    queryToken: Token | SkipJsonSchema[None] = None
    toolResults: Annotated[list[ToolResult], Field(max_length=1)] | SkipJsonSchema[None] = None
    @model_validator(mode='after')
    def stage(self):
        if self.queryToken is None:
            if self.context is None or self.toolResults: raise ValueError('Invalid first turn')
        elif not self.toolResults:
            raise ValueError('Tool result required')
        return self
class ToolCallsResponse(Wire):
    queryToken: Token
    toolCalls: Annotated[list[ToolCall], Field(min_length=1, max_length=1)]
class FinalResponse(Wire):
    queryToken: Token
    final: Final
class NotFoundResponse(Wire):
    queryToken: Token
    not_found: NotFound
SearchTurnResponse = ToolCallsResponse | FinalResponse | NotFoundResponse

class SegmentPhoto(Wire):
    photoRef: Ref
    image: Image
class SearchSegmentRequest(Wire):
    queryToken: Token
    photos: Annotated[list[SegmentPhoto], Field(min_length=1, max_length=3)]
    concept: Phrase
    @field_validator('photos')
    @classmethod
    def unique_refs(cls, value):
        if len({v.photoRef for v in value}) != len(value): raise ValueError('Duplicate refs')
        return value
class Mask(Wire):
    mimeType: Literal['image/png']
    data: Annotated[str, Field(min_length=4, max_length=11184812, json_schema_extra={'contentEncoding': 'base64'})]
    width: Annotated[int, Field(ge=1, le=2048)]
    height: Annotated[int, Field(ge=1, le=2048)]
    @model_validator(mode='after')
    def valid_mask(self):
        validate_image(self.data, self.mimeType, self.width, self.height, 8388608, mask=True)
        return self
class SegmentCandidate(Wire):
    id: Ref
    label: Phrase
    score: Score
    mask: Mask
    bbox: tuple[Annotated[int, Field(ge=0)], Annotated[int, Field(ge=0)], Annotated[int, Field(gt=0)], Annotated[int, Field(gt=0)]]
    @model_validator(mode='after')
    def bounds(self):
        x, y, w, h = self.bbox
        if x+w > self.mask.width or y+h > self.mask.height: raise ValueError('Bounding box outside mask')
        return self
class SegmentedPhoto(Wire):
    photoRef: Ref
    candidates: list[SegmentCandidate]
    @model_validator(mode='after')
    def consistency(self):
        if len({c.id for c in self.candidates}) != len(self.candidates) or any(a.score < b.score for a,b in zip(self.candidates, self.candidates[1:])): raise ValueError('Invalid candidate order or IDs')
        return self
class SearchSegmentResponse(Wire):
    queryToken: Token
    photos: Annotated[list[SegmentedPhoto], Field(min_length=1, max_length=3)]

class PayloadTooLarge(ValueError):
    pass

def validate_base64(value: str, maximum: int) -> str:
    try:
        raw = base64.b64decode(value, validate=True)
        if len(raw) > maximum:
            raise PayloadTooLarge('Decoded media too large')
        if base64.b64encode(raw).decode() != value:
            raise ValueError('Invalid base64')
    except PayloadTooLarge:
        raise
    except Exception as exc:
        raise ValueError('Invalid base64') from exc
    return value

def _gps_property(name):
    local = name.rsplit('}', 1)[-1].rsplit(':', 1)[-1].lower()
    return local.startswith('gps') or local in ('latitude', 'longitude', 'coordinates')


def _check_xmp_metadata(packet):
    # XML parsing handles namespace aliases and UTF-16; byte substring checks do not.
    try:
        root = ElementTree.fromstring(packet)
    except (ElementTree.ParseError, ValueError, TypeError, LookupError):
        raise ValueError('Invalid XMP metadata') from None
    for element in root.iter():
        if _gps_property(element.tag) or any(_gps_property(name) for name in element.attrib):
            raise ValueError('GPS metadata')


def _check_exif_metadata(exif):
    if 34853 in exif:
        raise ValueError('GPS metadata')
    if 700 in exif:
        _check_xmp_metadata(exif[700])


def _inflate_metadata(data):
    # Match Pillow's per-chunk text limit without allocating an unbounded bomb.
    inflater = zlib.decompressobj()
    try:
        decoded = inflater.decompress(data, 1048577)
    except zlib.error:
        raise ValueError('Invalid compressed metadata') from None
    if len(decoded) > 1048576 or not inflater.eof or inflater.unused_data:
        raise ValueError('Invalid compressed metadata')
    return decoded


def _check_png_metadata(raw):
    # Read every chunk, including duplicate keys and text following IDAT.
    # Pillow's info dict keeps only the last value for duplicate metadata keys.
    offset = 8
    while offset + 12 <= len(raw):
        size = int.from_bytes(raw[offset:offset + 4], 'big')
        tag = raw[offset + 4:offset + 8]
        end = offset + 12 + size
        if end > len(raw):
            raise ValueError('Invalid PNG metadata')
        if tag == b'eXIf':
            exif = PILImage.Exif()
            exif.load(raw[offset + 8:end - 4])
            _check_exif_metadata(exif)
        elif tag in (b'tEXt', b'zTXt', b'iTXt'):
            key, data = raw[offset + 8:end - 4].split(b'\0', 1)
            if _gps_property(key.decode('latin-1')):
                raise ValueError('GPS metadata')
            if tag == b'zTXt':
                if not data or data[0] != 0:
                    raise ValueError('Invalid compressed metadata')
                data = _inflate_metadata(data[1:])
            elif tag == b'iTXt':
                if len(data) < 2 or data[0] not in (0, 1) or data[1] != 0:
                    raise ValueError('Invalid international metadata')
                compressed = data[0]
                _, _, data = data[2:].split(b'\0', 2)
                if compressed:
                    data = _inflate_metadata(data)
            if key == b'XML:com.adobe.xmp':
                _check_xmp_metadata(data)
        offset = end
        if tag == b'IEND':
            break


def _check_upload_metadata(image, raw):
    _check_exif_metadata(image.getexif())
    if image.format == 'PNG':
        _check_png_metadata(raw)
    else:
        for marker, data in image.applist:
            if marker != 'APP1':
                continue
            if data.startswith(b'Exif\0\0'):
                exif = PILImage.Exif()
                exif.load(data)
                _check_exif_metadata(exif)
            elif data.startswith(b'http://ns.adobe.com/xap/1.0/\0'):
                _check_xmp_metadata(data.split(b'\0', 1)[1])
            elif data.startswith(b'http://ns.adobe.com/xmp/extension/\0'):
                # Fragmented extension packets cannot be treated as GPS-free.
                raise ValueError('Unsupported extended XMP metadata')


def validate_image(value, mime, width, height, maximum, *, reject_gps=False, mask=False):
    validate_base64(value, maximum)
    try:
        raw = base64.b64decode(value)
        with PILImage.open(io.BytesIO(raw)) as image:
            if image.format != {'image/png': 'PNG', 'image/jpeg': 'JPEG'}[mime] or image.size != (width, height):
                raise ValueError('Image format or dimensions mismatch')
            if getattr(image, 'n_frames', 1) != 1:
                raise ValueError('Multiple image frames')
            image.load()
            if reject_gps:
                _check_upload_metadata(image, raw)
            if mask and (image.mode != 'L' or any(v not in (0, 255) for v in image.getdata())):
                raise ValueError('Invalid binary mask')
    except (UnidentifiedImageError, OSError, SyntaxError, struct.error, PILImage.DecompressionBombError) as exc:
        raise ValueError('Invalid image') from exc

class Audio(Wire):
    mimeType: Literal['audio/wav']
    data: Annotated[str, Field(min_length=4, max_length=699052, json_schema_extra={'contentEncoding': 'base64'})]
    @field_validator('data')
    @classmethod
    def encoded(cls, value):
        validate_base64(value, 524288)
        raw = base64.b64decode(value)
        if len(raw) < 44 or raw[:4] != b'RIFF' or raw[8:12] != b'WAVE' or struct.unpack_from('<I', raw, 4)[0] != len(raw) - 8:
            raise ValueError('Invalid WAV')
        pos, chunks = 12, {}
        while pos + 8 <= len(raw):
            tag, size = struct.unpack_from('<4sI', raw, pos)
            pos += 8
            if tag not in (b'fmt ', b'data') or tag in chunks or pos + size > len(raw):
                raise ValueError('Invalid WAV chunk')
            chunks[tag] = raw[pos:pos + size]
            pos += size + (size % 2)
        if pos != len(raw) or set(chunks) != {b'fmt ', b'data'} or len(chunks[b'fmt ']) != 16:
            raise ValueError('Invalid WAV chunks')
        if struct.unpack('<HHIIHH', chunks[b'fmt ']) != (1, 1, 16000, 32000, 2, 16) or len(chunks[b'data']) % 2 or not 1 <= len(chunks[b'data']) // 2 <= 240000:
            raise ValueError('Invalid PCM samples')
        return value
class TranscribeRequest(Wire):
    audio: Audio
class TranscribeResponse(Wire):
    text: Annotated[str, Field(max_length=2000)]
    language: Literal['en']
class DescribeRequest(Wire):
    image: Image
class StorefrontResponse(Wire):
    description: NonBlank300
class PieceResponse(Wire):
    label: Annotated[str, StringConstraints(min_length=1, max_length=120, pattern=r'\S')]
    category: Annotated[str, StringConstraints(min_length=1, max_length=64, pattern=r'\S')]
class MaskedSelfPhoto(Wire):
    image: Image
    headMasked: Literal[True]
class TryOnPiece(Wire):
    pieceRef: Ref
    image: Image
    label: Annotated[str, StringConstraints(min_length=1, max_length=120, pattern=r'\S')]
    category: Annotated[str, StringConstraints(min_length=1, max_length=64, pattern=r'\S')]
    origin: Literal['shop', 'wardrobe']
class TryOnRequest(Wire):
    selfPhoto: MaskedSelfPhoto
    target: TryOnPiece
    companions: Annotated[list[TryOnPiece], Field(max_length=5)]
    @model_validator(mode='after')
    def consistency(self):
        refs = [self.target.pieceRef, *(p.pieceRef for p in self.companions)]
        if self.target.origin != 'shop' or len(set(refs)) != len(refs): raise ValueError('Invalid target or duplicate refs')
        return self
class GeneratedImage(Wire):
    mimeType: Literal['image/jpeg', 'image/png']
    data: Annotated[str, Field(min_length=4, max_length=44739244, json_schema_extra={'contentEncoding': 'base64'})]
    width: Annotated[int, Field(ge=1, le=8192)]
    height: Annotated[int, Field(ge=1, le=8192)]
    @model_validator(mode='after')
    def pixels(self):
        if self.width * self.height > 33554432: raise ValueError('Image too large')
        validate_image(self.data, self.mimeType, self.width, self.height, 33554432)
        return self
class TryOnResponse(Wire):
    image: GeneratedImage
class RouteRequest(Wire):
    origin: Point
    destination: Point
class Geometry(Wire):
    type: Literal['LineString']
    coordinates: Annotated[list[Coordinate], Field(min_length=2)]
class Maneuver(Wire):
    type: str
    modifier: str | SkipJsonSchema[None] = None
    location: Coordinate
    bearingBefore: Annotated[float, Field(ge=0, lt=360)]
    bearingAfter: Annotated[float, Field(ge=0, lt=360)]
class RouteStep(Wire):
    distanceM: Annotated[float, Field(ge=0)]
    durationS: Annotated[float, Field(ge=0)]
    name: str
    maneuver: Maneuver
class Waypoint(Wire):
    location: Coordinate
    distanceM: Annotated[float, Field(ge=0)]
class RouteResponse(Wire):
    geometry: Geometry
    distanceM: Annotated[float, Field(ge=0)]
    durationS: Annotated[float, Field(ge=0)]
    steps: list[RouteStep]
    waypoints: Annotated[list[Waypoint], Field(min_length=2, max_length=2)]
