import dns from "node:dns";

dns.setServers([
  "1.1.1.1", // Cloudflare
  "1.0.0.1",
  "8.8.8.8", // Google
  "8.8.4.4",
]);
dns.setDefaultResultOrder("ipv4first");

export async function register() {
  // DNS configuration is applied at module load time above.
  // This export satisfies Next.js instrumentation conventions.
}
