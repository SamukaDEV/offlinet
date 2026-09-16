import os from "os";

export function getLanAddresses(port: number = 3000): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;

    for (const net of netList) {
      // IPv4 and not internal loopback
      const family = typeof net.family === "string" ? net.family : (net as any).family === 4 ? "IPv4" : "";
      if ((family === "IPv4" || (net as any).family === 4) && !net.internal) {
        addresses.push(`http://${net.address}:${port}`);
      }
    }
  }

  // Always include localhost
  addresses.push(`http://localhost:${port}`);
  return Array.from(new Set(addresses));
}
