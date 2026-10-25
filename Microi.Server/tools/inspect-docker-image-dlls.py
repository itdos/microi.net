"""Read a docker image save archive without extracting paths or creating containers."""
import gzip
import hashlib
import json
import re
import sys
import tarfile


def safe_name(name):
    if name.startswith("/") or "\\" in name or "\0" in name:
        raise ValueError("Unsafe image archive path")
    parts = [part for part in name.split("/") if part not in ("", ".")]
    if ".." in parts:
        raise ValueError("Unsafe image archive path")
    return "/".join(parts)


class DigestReader:
    def __init__(self, source):
        self.source = source
        self.digest = hashlib.sha256()

    def read(self, size=-1):
        if size < 0:
            raise ValueError("Unbounded image layer read")
        data = self.source.read(size)
        self.digest.update(data)
        return data


def describe(source, size):
    if not 0 < size <= 64 * 1024 * 1024:
        raise ValueError("Invalid image DLL size")
    sha, md5, count = hashlib.sha256(), hashlib.md5(), 0
    while True:
        data = source.read(1024 * 1024)
        if not data:
            break
        sha.update(data)
        md5.update(data)
        count += len(data)
    if count != size:
        raise ValueError("Truncated image DLL")
    return {"bytes": count, "sha256": sha.hexdigest(), "md5": md5.hexdigest()}


def inspect_image(filename, image_id, dll_names):
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
        raise ValueError("Invalid immutable Docker image ID")
    if not dll_names or len(set(dll_names)) != len(dll_names) or any(
        not re.fullmatch(r"[A-Za-z0-9_.-]+\.dll", name) for name in dll_names
    ):
        raise ValueError("Invalid required DLL names")
    targets = {"app/" + name: name for name in dll_names}
    state = {}
    with tarfile.open(filename, "r:*") as archive:
        entries = {}
        for entry in archive:
            name = safe_name(entry.name)
            if name in entries:
                raise ValueError("Duplicate image archive entry: " + name)
            entries[name] = entry

        def entry_stream(name):
            entry = entries.get(safe_name(name))
            if entry is None or not entry.isfile():
                raise ValueError("Missing or linked image archive entry: " + name)
            return archive.extractfile(entry), entry.size

        def small_entry(name, limit):
            stream, size = entry_stream(name)
            if not 0 < size <= limit:
                raise ValueError("Invalid image metadata size")
            with stream:
                data = stream.read(limit + 1)
            if len(data) != size:
                raise ValueError("Truncated image metadata")
            return data

        manifest = json.loads(small_entry("manifest.json", 1024 * 1024))
        if not isinstance(manifest, list) or len(manifest) != 1:
            raise ValueError("Expected one immutable image in Docker save archive")
        image = manifest[0]
        config_bytes = small_entry(image["Config"], 16 * 1024 * 1024)
        if "sha256:" + hashlib.sha256(config_bytes).hexdigest() != image_id:
            raise ValueError("Docker config digest differs from immutable image ID")
        config = json.loads(config_bytes)
        layers, diff_ids = image["Layers"], config["rootfs"]["diff_ids"]
        if config["rootfs"].get("type") != "layers" or not layers or len(layers) != len(diff_ids):
            raise ValueError("Docker layer inventory differs from image config")
        for layer_name, diff_id in zip(layers, diff_ids):
            raw, _ = entry_stream(layer_name)
            with raw:
                magic = raw.read(2)
                raw.seek(0)
                source = gzip.GzipFile(fileobj=raw) if magic == b"\x1f\x8b" else raw
                reader = DigestReader(source)
                updates, removals, seen = {}, set(), set()
                with tarfile.open(fileobj=reader, mode="r|") as layer:
                    for member in layer:
                        name = safe_name(member.name)
                        parent, _, basename = name.rpartition("/")
                        affected = set()
                        if basename == ".wh..wh..opq":
                            affected = {target for target in targets if not parent or target.startswith(parent + "/")}
                        elif basename.startswith(".wh."):
                            removed = (parent + "/" if parent else "") + basename[4:]
                            affected = {target for target in targets if target == removed or target.startswith(removed + "/")}
                        if affected:
                            if not member.isfile() or member.size != 0:
                                raise ValueError("Invalid relevant Docker whiteout")
                            removals.update(affected)
                            continue
                        relevant = name == "app" or name in targets or any(name.startswith(target + "/") for target in targets)
                        if not relevant:
                            continue
                        if member.issym() or member.islnk():
                            raise ValueError("Linked image DLL or ancestor: " + name)
                        if name == "app":
                            if not member.isdir():
                                raise ValueError("Image app ancestor is not a directory")
                            continue
                        if name not in targets:
                            raise ValueError("Image DLL is used as a directory: " + name)
                        if name in seen:
                            raise ValueError("Duplicate DLL in image layer: " + name)
                        seen.add(name)
                        if not member.isfile():
                            raise ValueError("Image DLL is not a regular file: " + name)
                        with layer.extractfile(member) as stream:
                            updates[name] = describe(stream, member.size)
                # tarfile stops at the tar EOF blocks; diff_id covers every uncompressed byte.
                while reader.read(1024 * 1024):
                    pass
                if "sha256:" + reader.digest.hexdigest() != diff_id:
                    raise ValueError("Docker layer digest differs from image config")
                if source is not raw:
                    source.close()
                # Whiteouts affect lower layers, never files added alongside them.
                for target in removals:
                    state.pop(target, None)
                state.update(updates)
        missing = [name for target, name in targets.items() if target not in state]
        if missing:
            raise ValueError("Missing final image DLLs: " + ", ".join(missing))
        return {"imageId": image_id, "dlls": {name: state[target] for target, name in targets.items()}}


if __name__ == "__main__":
    try:
        print(json.dumps(inspect_image(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]))))
    except Exception as error:
        print("Static Docker DLL verification failed: " + str(error), file=sys.stderr)
        sys.exit(1)
