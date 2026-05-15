# ASTRA-IDE — ASCII Logo

Drop this into terminal headers, CI banners, or the collab server's startup log.

```
       /\
      /  \         █████╗ ███████╗████████╗██████╗  █████╗
     /    \       ██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗
    /  ◇   \      ███████║███████╗   ██║   ██████╔╝███████║
   /________\     ██╔══██║╚════██║   ██║   ██╔══██╗██╔══██║
  /          \    ██║  ██║███████║   ██║   ██║  ██║██║  ██║
 /____________\   ╚═╝  ╚═╝╚══════╝   ╚═╝  ╚═╝  ╚═╝╚═╝  ╚═╝
   ╲       ╱
    ╲ ●━━━╱            cloud  IDE  that  schedules  itself
     ╲___╱
                  <  I  D  E  />
```

Compact one-line:

```
    /\
   /  \  ASTRA-IDE  <IDE/>   — adaptive scheduling · ebpf · sandboxing · crdt
  /____\
```

Tiny banner (good for CLI welcome message):

```
  ╔══════════════════════════════════════════════════════╗
  ║   /\   ASTRA-IDE  v0.1                              ║
  ║  /◇ \  cloud IDE that schedules itself              ║
  ║ /____\ DRL · eBPF · sandbox · CRDT · multi-cluster  ║
  ╚══════════════════════════════════════════════════════╝
```

## Use in code

JavaScript (collab-server startup log):
```javascript
console.log(`
    /\\
   /  \\   ASTRA-IDE collab server v0.1
  /◇   \\  http://localhost:1234
 /______\\
`);
```

Python (backend startup):
```python
BANNER = r"""
    /\
   /  \   ASTRA-IDE backend
  /◇   \  http://localhost:8000/api/v1/docs
 /______\
"""
```
