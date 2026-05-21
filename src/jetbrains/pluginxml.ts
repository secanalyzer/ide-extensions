import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import yauzl from "yauzl";

export interface PluginXmlInfo {
  id?: string;
  name?: string;
  version?: string;
  vendor?: string;
  vendorUrl?: string;
  vendorEmail?: string;
  description?: string;
}

export async function readPluginXml(pluginDir: string): Promise<PluginXmlInfo | null> {
  const directPath = join(pluginDir, "META-INF", "plugin.xml");
  if (existsSync(directPath)) {
    return parsePluginXml(readFileSync(directPath, "utf8"));
  }

  const libDir = join(pluginDir, "lib");
  if (!existsSync(libDir)) return null;

  const jars = readdirSync(libDir)
    .filter((f) => f.endsWith(".jar"))
    .map((f) => ({ name: f, full: join(libDir, f), size: statSync(join(libDir, f)).size }))
    .sort((a, b) => preferJar(a.name, b.name) || b.size - a.size);

  for (const jar of jars) {
    const xml = await tryReadFromJar(jar.full);
    if (xml) {
      const parsed = parsePluginXml(xml);
      if (parsed.id) return parsed;
    }
  }
  return null;
}

function preferJar(a: string, b: string): number {
  const score = (n: string) => {
    if (/-rt\.jar$|util\.jar$|^kotlin-|coroutines/i.test(n)) return 1;
    return 0;
  };
  return score(a) - score(b);
}

function tryReadFromJar(jarPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    yauzl.open(jarPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        resolve(null);
        return;
      }
      let found = false;
      zipfile.on("entry", (entry) => {
        if (entry.fileName === "META-INF/plugin.xml") {
          found = true;
          zipfile.openReadStream(entry, (e, stream) => {
            if (e || !stream) {
              zipfile.close();
              resolve(null);
              return;
            }
            const chunks: Buffer[] = [];
            stream.on("data", (c: Buffer) => chunks.push(c));
            stream.on("end", () => {
              zipfile.close();
              resolve(Buffer.concat(chunks).toString("utf8"));
            });
            stream.on("error", () => {
              zipfile.close();
              resolve(null);
            });
          });
        } else {
          zipfile.readEntry();
        }
      });
      zipfile.on("end", () => {
        if (!found) resolve(null);
      });
      zipfile.on("error", () => resolve(null));
      zipfile.readEntry();
    });
  });
}

function parsePluginXml(xml: string): PluginXmlInfo {
  const stripped = xml.replace(/<!--[\s\S]*?-->/g, "");
  return {
    id: textOf(stripped, "id"),
    name: textOf(stripped, "name"),
    version: textOf(stripped, "version"),
    vendor: textOf(stripped, "vendor"),
    vendorUrl: attrOf(stripped, "vendor", "url"),
    vendorEmail: attrOf(stripped, "vendor", "email"),
    description: textOf(stripped, "description"),
  };
}

function textOf(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m || m[1] === undefined) return undefined;
  return decode(m[1]).trim() || undefined;
}

function attrOf(xml: string, tag: string, attr: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]*)"`, "i"));
  return m?.[1];
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
