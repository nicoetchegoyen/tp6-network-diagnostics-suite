import { Device } from "./types";

// Una IP privada se puede repetir entre clientes o cambiar entre visitas.
export function findEquipment(
  devices: Device[],
  incoming: Pick<Device, "ip" | "site" | "mac">,
) {
  return devices.find((device) => {
    if (device.site.trim().toLowerCase() !== incoming.site.trim().toLowerCase())
      return false;
    if (device.mac && incoming.mac)
      return device.mac.toLowerCase() === incoming.mac.toLowerCase();
    return device.ip === incoming.ip;
  });
}
