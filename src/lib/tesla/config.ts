export type TeslaRegion = "na" | "eu" | "cn";

const authBase = "https://auth.tesla.com";
const fleetHosts: Record<TeslaRegion, string> = {
  na: "https://fleet-api.prd.na.vn.cloud.tesla.com",
  eu: "https://fleet-api.prd.eu.vn.cloud.tesla.com",
  cn: "https://fleet-api.prd.cn.vn.cloud.tesla.com",
};

export function getTeslaConfig() {
  const region = process.env.TESLA_REGION || "na";
  if (!(region in fleetHosts)) throw new Error("Invalid TESLA_REGION");
  return {
    clientId: process.env.TESLA_CLIENT_ID || "",
    clientSecret: process.env.TESLA_CLIENT_SECRET || "",
    redirectUri: process.env.TESLA_REDIRECT_URI || "",
    region: region as TeslaRegion,
    authBase,
    fleetBase: fleetHosts[region as TeslaRegion],
  };
}

export function isTeslaConfigured() {
  const config = getTeslaConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri && process.env.TESLA_ENCRYPTION_KEY);
}
