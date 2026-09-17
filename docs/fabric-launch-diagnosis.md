# Fabric 26.2 launch investigation (2026-09-13)

## Observed hang

The attached log alone does not establish a Mixin failure. A live `jcmd 19844 Thread.print` at 20:44:02 showed the main thread, after 391 seconds, blocked in this call chain:

```text
SocketDispatcher.read0
SSLSocketImpl.readHandshakeRecord / startHandshake
SSLConnectionSocketFactory.createLayeredSocket / connectSocket
CloseableHttpClient.execute
net.taunahi.nativeautopatch.Main.init
net.taunahi.autopatch.FabricTweaker.onPreLaunch
FabricLoaderImpl.invokeEntrypoints
Knot.init / Knot.launch / KnotClient.main
```

The process had three established TCP connections to 104.26.11.227:443. DNS resolution for taunahi.net included that address. This establishes a stalled TLS handshake during Taunahi pre-launch, not a bad main class or a Mixin deadlock. The exact request hostname and underlying network/server cause were not captured. The process subsequently disappeared without further output in its launch log; this investigation did not terminate it.

A separate SSLSocket probe using the same installed Java 25.0.3 completed TLS 1.3 and TLS 1.2 handshakes with taunahi.net. That probe does not reproduce Taunahi's Apache HttpClient request and is not proof that the original request now works. No TLS restrictions, certificate bypasses, or mod changes were applied.

## Launch audit

- Java selection: the frontend selects Java 25 for 26.x unless an instance override is set. The live process used the installed Java 25.0.3.
- Main class and ordering: the backend passes JVM arguments, then the profile main class, then game arguments using `Command::args`, without a shell. The thread dump confirms `net.fabricmc.loader.impl.launch.knot.KnotClient` executed.
- Fabric metadata: the local profile matches the live official endpoint https://meta.fabricmc.net/v2/versions/loader/26.2/0.19.3/profile/json. Its `-DFabricMcEmu= net.minecraft.client.main.Main ` is intentionally one JVM argument, including spaces. It is not the executable main class. No intermediary mappings library is present in this profile; one must not be invented to suppress the mappings message.
- Classpath: parent libraries are collected before loader libraries, with child replacement by Maven group/artifact/classifier, and the client JAR last. Windows entries use semicolons, and the complete classpath is one process argument. The loader reached pre-launch, so its entry point and dependencies were available.
- LWJGL: local Mojang 26.2 metadata declares 3.4.1, including the `unsafe` core classifier. The launcher was silently rewriting all LWJGL 3.x coordinates and URLs to 3.4.2. Removed this override so downloads and launch use the declared artifacts. This is a separate correctness fix, not evidence for the observed TLS hang.
- Natives: legacy classifier archives are extracted by the launcher; modern native artifacts remain on the classpath for library-managed extraction. Multiple Windows architecture JARs in the official metadata are not by themselves evidence of conflicting DLL extraction. No native-load exception was observed in the supplied log or live stack. Architecture selection currently follows the launcher build, not a probe of a user-selected Java runtime; cross-architecture overrides remain a limitation.
- Instance JVM text previously used `split_whitespace`, breaking quoted paths. Added quote-aware tokenization with an explicit error for unmatched quotes; metadata arrays remain untouched.
- Game arguments were reconstructed by a Prism-style filter that discarded `--clientId` and `--xuid`. Launch now preserves resolved metadata game arguments, including loader additions.
- Missing loader profiles previously fell back silently to vanilla. Launch now fails instead, and Fabric profile selection checks the exact parent, loader dependency and main class.
- The JVM fallback now supplies a classpath even when a profile provides other JVM flags without a classpath. Diagnostics record the selected Java path, main class, and argument ordering.

## Validation and limits

Regression tests cover quoted JVM paths, the exact Fabric argument and inherited classpath, preservation of game arguments, and refusing vanilla fallback. No mods were disabled or edited. No account credentials were extracted for a second game launch.

The launcher corrections do not constitute a verified fix of the Taunahi TLS stall. Resolving that remaining issue requires reproducing the failing request or fixing its timeout/network behavior in Taunahi's pre-launch implementation, whose source is not part of this repository.
