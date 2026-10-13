"""Client HTTP del gestionale Usati (admin/server.mjs). Solo libreria standard,
eseguito in un thread per non bloccare il loop asincrono del bot."""
import asyncio
import json
import urllib.error
import urllib.request
import uuid

from . import config


class ApiError(Exception):
    pass


def _request(method: str, path: str, body: bytes | None = None, content_type: str | None = None) -> dict:
    req = urllib.request.Request(config.API_BASE + path, data=body, method=method)
    if content_type:
        req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode("utf-8")).get("error")
        except Exception:
            msg = None
        raise ApiError(msg or f"Errore {e.code} dal gestionale") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise ApiError("Gestionale non raggiungibile: e' avviato (npm run admin)?") from e


def _json(method: str, path: str, payload: dict | None = None) -> dict:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    return _request(method, path, body, "application/json" if body else None)


def _multipart(fields: dict[str, str], files: list[bytes]) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    for k, v in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8")
        )
    for i, data in enumerate(files):
        parts.append(
            (
                f'--{boundary}\r\nContent-Disposition: form-data; name="photos"; '
                f'filename="foto{i + 1}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'
            ).encode("utf-8")
            + data
            + b"\r\n"
        )
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def _list_items() -> list[dict]:
    return _json("GET", "/api/items")["items"]


def _create_item(data: dict, photos: list[bytes]) -> dict:
    body, ctype = _multipart({"data": json.dumps(data)}, photos)
    return _request("POST", "/api/items", body, ctype)


def _patch_item(slug: str, fields: dict) -> dict:
    return _json("PATCH", f"/api/items/{slug}", fields)


def _action(slug: str, action: str) -> dict:
    # action: "sold" | "unsold"
    return _json("POST", f"/api/items/{slug}/{action}", {})


def _delete_item(slug: str) -> dict:
    return _json("DELETE", f"/api/items/{slug}")


async def list_items() -> list[dict]:
    return await asyncio.to_thread(_list_items)


async def create_item(data: dict, photos: list[bytes]) -> dict:
    return await asyncio.to_thread(_create_item, data, photos)


async def patch_item(slug: str, fields: dict) -> dict:
    return await asyncio.to_thread(_patch_item, slug, fields)


async def mark_sold(slug: str) -> dict:
    return await asyncio.to_thread(_action, slug, "sold")


async def mark_unsold(slug: str) -> dict:
    return await asyncio.to_thread(_action, slug, "unsold")


async def delete_item(slug: str) -> dict:
    return await asyncio.to_thread(_delete_item, slug)
