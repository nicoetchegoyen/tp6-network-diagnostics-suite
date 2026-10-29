package ar.edu.fcyt.fieldkit.network

import android.content.Context
import android.content.Intent
import android.os.Build
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.util.Base64
import com.jcraft.jsch.ChannelExec
import com.jcraft.jsch.HostKey
import com.jcraft.jsch.HostKeyRepository
import com.jcraft.jsch.JSch
import com.jcraft.jsch.UserInfo
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.net.*
import java.security.MessageDigest
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean

class FieldNetworkModule : Module() {
  private val cancelled = AtomicBoolean(false)
  override fun definition() = ModuleDefinition {
    Name("FieldNetwork")
    Events("scanProgress")
    Function("runtimeInfo") {
      mapOf("emulator" to (Build.HARDWARE in listOf("ranchu", "goldfish") || Build.FINGERPRINT.startsWith("generic") || Build.MODEL.contains("Emulator")))
    }
    AsyncFunction("openPdf") { uri: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Contexto no disponible")
      context.startActivity(Intent(context, PdfPreviewActivity::class.java).putExtra("uri", uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("networkInfo") {
      val addresses = NetworkInterface.getNetworkInterfaces().toList().filter { it.isUp && !it.isLoopback }.sortedBy { if (it.name.startsWith("wlan") || it.name.startsWith("wifi")) 0 else 1 }.flatMap { it.interfaceAddresses }.filter { it.address is Inet4Address }
      val a = addresses.firstOrNull { it.address.isSiteLocalAddress } ?: addresses.firstOrNull()
      mapOf("ip" to a?.address?.hostAddress, "prefix" to (a?.networkPrefixLength?.toInt() ?: 24))
    }
    // Conectar el datagrama filtra respuestas que no provengan del host/puerto solicitado.
    AsyncFunction("exchangeUdp") { host: String, port: Int, encoded: String, timeout: Int ->
      require(port in 1..65535 && timeout in 100..15000)
      val bytes = Base64.decode(encoded, Base64.NO_WRAP)
      require(bytes.size <= 65507)
      DatagramSocket().use { socket ->
        socket.soTimeout = timeout
        socket.connect(InetAddress.getByName(host), port)
        socket.send(DatagramPacket(bytes, bytes.size))
        val data = ByteArray(65535); val response = DatagramPacket(data, data.size)
        socket.receive(response)
        Base64.encodeToString(data.copyOf(response.length), Base64.NO_WRAP)
      }
    }
    Function("cancelScan") { cancelled.set(true) }
    Function("resetScan") { cancelled.set(false) }
    AsyncFunction("scan") { hosts: List<String>, timeout: Int, probe: String, udpPort: Int ->
      require(hosts.size <= 1024 && timeout in 100..15000 && udpPort in 1..65535)
      val probeBytes = Base64.decode(probe, Base64.NO_WRAP)
      require(probeBytes.size <= 65507)
      val pool = Executors.newFixedThreadPool(24)
      val results = ConcurrentLinkedQueue<Map<String, Any?>>()
      val completed = java.util.concurrent.atomic.AtomicInteger(0)
      try {
        val futures = hosts.map { host -> pool.submit {
          if (!cancelled.get()) {
            val open = mutableListOf<Int>(); var active = false; var source = "tcp"
            for (port in listOf(22, 80, 443, 8291)) {
              if (cancelled.get()) break
              try { Socket().use { it.connect(InetSocketAddress(host, port), timeout); open.add(port); active = true } }
              catch (_: Exception) {}
            }
            if (!active && !cancelled.get()) {
              source = "udp"
              try {
                DatagramSocket().use { socket ->
                  socket.soTimeout = timeout
                  socket.connect(InetAddress.getByName(host), udpPort)
                  socket.send(DatagramPacket(probeBytes, probeBytes.size))
                  socket.receive(DatagramPacket(ByteArray(65535), 65535))
                  active = true
                }
              } catch (_: Exception) {}
            }
            if (active) results.add(mapOf("ip" to host, "ports" to open, "source" to source, "mac" to arpMac(host)))
          }
          val n = completed.incrementAndGet()
          sendEvent("scanProgress", mapOf("completed" to n, "total" to hosts.size, "found" to results.size))
        } }
        futures.forEach { it.get() }
        results.toList()
      } finally { pool.shutdownNow() }
    }
    AsyncFunction("discoverMdns") { duration: Int ->
      require(duration in 500..15000)
      val ctx = appContext.reactContext ?: throw IllegalStateException("Contexto no disponible")
      val nsd = ctx.getSystemService(Context.NSD_SERVICE) as NsdManager
      val wifi = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      val lock = wifi.createMulticastLock("fieldkit-mdns").apply { setReferenceCounted(false); acquire() }
      val results = ConcurrentLinkedQueue<Map<String, Any?>>()
      val listeners = mutableListOf<NsdManager.DiscoveryListener>()
      // NsdManager solo admite una resolución concurrente en Android anteriores.
      val resolver = Executors.newSingleThreadExecutor()
      try {
        for (type in listOf("_ssh._tcp.", "_http._tcp.", "_https._tcp.", "_workstation._tcp.", "_snmp._udp.")) {
          val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(t: String) {}
            override fun onDiscoveryStopped(t: String) {}
            override fun onStartDiscoveryFailed(t: String, code: Int) {}
            override fun onStopDiscoveryFailed(t: String, code: Int) {}
            override fun onServiceLost(info: NsdServiceInfo) {}
            override fun onServiceFound(info: NsdServiceInfo) {
              resolver.submit {
                val latch = CountDownLatch(1)
                try { nsd.resolveService(info, object : NsdManager.ResolveListener {
                  override fun onResolveFailed(i: NsdServiceInfo, code: Int) { latch.countDown() }
                  override fun onServiceResolved(i: NsdServiceInfo) {
                    val host = i.host?.hostAddress
                    if (host != null && i.host is Inet4Address) results.add(mapOf("ip" to host, "serviceName" to i.serviceName, "ports" to listOf(i.port), "source" to "mdns", "mac" to arpMac(host)))
                    latch.countDown()
                  }
                }); latch.await(2, TimeUnit.SECONDS) } catch (_: Exception) {}
              }
            }
          }
          try { nsd.discoverServices(type, NsdManager.PROTOCOL_DNS_SD, listener); listeners.add(listener) } catch (_: Exception) {}
        }
        Thread.sleep(duration.toLong())
      } finally {
        listeners.forEach { try { nsd.stopServiceDiscovery(it) } catch (_: Exception) {} }
        resolver.shutdown(); resolver.awaitTermination(3, TimeUnit.SECONDS); resolver.shutdownNow()
        if (lock.isHeld) lock.release()
      }
      results.toList()
    }
    // Obtiene la clave pública sin enviar credenciales. El usuario verifica su huella.
    AsyncFunction("sshFingerprint") { host: String, port: Int ->
      var fingerprint = ""
      val jsch = JSch()
      jsch.setHostKeyRepository(repository { key -> fingerprint = sha256(key); HostKeyRepository.NOT_INCLUDED })
      val session = jsch.getSession("fieldkit-key-check", host, port)
      session.setConfig("StrictHostKeyChecking", "yes")
      try { session.connect(6000) } catch (e: Exception) { if (fingerprint.isEmpty()) throw e } finally { session.disconnect() }
      fingerprint
    }
    AsyncFunction("sshExec") { host: String, port: Int, username: String, password: String, fingerprint: String, command: String ->
      require(port in 1..65535 && username.isNotBlank() && fingerprint.startsWith("SHA256:"))
      require(command in ALLOWED_COMMANDS) { "Comando no permitido" }
      val jsch = JSch()
      jsch.setHostKeyRepository(repository { key -> if (sha256(key) == fingerprint) HostKeyRepository.OK else HostKeyRepository.CHANGED })
      val session = jsch.getSession(username, host, port)
      session.setConfig("StrictHostKeyChecking", "yes")
      session.setConfig("PreferredAuthentications", "password,keyboard-interactive")
      session.setPassword(password)
      session.timeout = 10000
      var channel: ChannelExec? = null
      try {
        session.connect(10000)
        channel = session.openChannel("exec") as ChannelExec
        channel.setCommand(command)
        val output = ByteArrayOutputStream(); val errors = ByteArrayOutputStream()
        channel.setOutputStream(output); channel.setErrStream(errors)
        channel.connect(10000)
        val deadline = System.currentTimeMillis() + 20000
        while (!channel.isClosed) {
          if (System.currentTimeMillis() > deadline) throw SocketTimeoutException("Timeout del comando SSH")
          if (output.size() + errors.size() > 1024 * 1024) throw IllegalStateException("Salida SSH excede 1 MiB")
          Thread.sleep(40)
        }
        mapOf("stdout" to output.toString("UTF-8"), "stderr" to errors.toString("UTF-8"), "exitCode" to channel.exitStatus, "command" to command)
      } finally { channel?.disconnect(); session.disconnect() }
    }
    OnDestroy { cancelled.set(true) }
  }
  private fun arpMac(host: String): String? = try {
    java.io.File("/proc/net/arp").readLines().drop(1).map { it.trim().split(Regex("\\s+")) }.firstOrNull { it.size > 3 && it[0] == host && it[3] != "00:00:00:00:00:00" }?.get(3)
  } catch (_: Exception) { null } // Android 10+ puede impedir acceso; no inventar MAC.
  private fun sha256(key: ByteArray) = "SHA256:" + Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(key), Base64.NO_WRAP or Base64.NO_PADDING)
  private fun repository(check: (ByteArray) -> Int) = object : HostKeyRepository {
    override fun check(host: String, key: ByteArray) = check(key)
    override fun add(key: HostKey, ui: UserInfo?) {}
    override fun remove(host: String, type: String) {}
    override fun remove(host: String, type: String, key: ByteArray) {}
    override fun getKnownHostsRepositoryID() = "Fieldkit pinned host keys"
    override fun getHostKey(): Array<HostKey> = emptyArray()
    override fun getHostKey(host: String?, type: String?): Array<HostKey> = emptyArray()
  }
  companion object {
    val ALLOWED_COMMANDS = setOf("uptime", "ip -s address show", "ip route show", "/system resource print", "/interface print stats", "/ip route print", "show version", "show interfaces", "show ip route")
  }
}
