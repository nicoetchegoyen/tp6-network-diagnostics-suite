export const COMMANDS = {
  linux: [
    { id: "uptime", label: "Tiempo activo", command: "uptime" },
    {
      id: "interfaces",
      label: "Interfaces y direcciones",
      command: "ip -s address show",
    },
    { id: "routes", label: "Tabla de rutas", command: "ip route show" },
  ],
  mikrotik: [
    {
      id: "uptime",
      label: "Recursos del sistema",
      command: "/system resource print",
    },
    {
      id: "interfaces",
      label: "Tráfico de interfaces",
      command: "/interface print stats",
    },
    { id: "routes", label: "Tabla de rutas", command: "/ip route print" },
  ],
  cisco: [
    { id: "uptime", label: "Versión y tiempo activo", command: "show version" },
    { id: "interfaces", label: "Interfaces", command: "show interfaces" },
    { id: "routes", label: "Tabla de rutas", command: "show ip route" },
  ],
} as const;
export type Vendor = keyof typeof COMMANDS;
export function diagnosticCommand(vendor: Vendor, id: string): string {
  const command = COMMANDS[vendor]?.find((c) => c.id === id)?.command;
  if (!command) throw new Error("Comando de diagnóstico no permitido.");
  return command;
}
