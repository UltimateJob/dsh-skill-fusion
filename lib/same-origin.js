export function isSameOriginRequest(req) {
  const headers = req?.headers ?? {};
  const site = headers["sec-fetch-site"];
  if (typeof site === "string" && site === "cross-site") return false;
  const origin = headers.origin;
  if (typeof origin === "string" && origin !== "" && origin !== "null") {
    const host = headers.host;
    if (typeof host !== "string" || host === "") return false;
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}
