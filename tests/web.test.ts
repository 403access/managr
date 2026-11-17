import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeHtmlEntities,
  htmlToText,
  parseBingResults,
  parseDuckDuckGoResults,
  webEnabled,
  webFetch,
  webSearch,
} from "@/server/web";
import { enabledTools, findTool } from "@/server/tools";

afterEach(() => {
  vi.unstubAllEnvs();
});

const ddg = `
  <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fit.works-gmbh.de%2F&amp;rut=1" class='result-link'>IT.Works | Partner im Raum Heilbronn</a>
  <td class='result-snippet'><b>IT.Works</b> ist regionaler Partner für den Mittelstand.</td>
  <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.northdata.de%2FIT%2BWorks%2BGmbH&amp;rut=2" class='result-link'>IT Works GmbH, Heilbronn - North Data</a>
  <td class='result-snippet'>Handelsregister und Gesellschafter.</td>
  <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fit.works-gmbh.de%2F&amp;rut=3" class='result-link'>Duplicate</a>
  <td class='result-snippet'>Should be removed.</td>
`;

const bing = `
  <li class="b_algo">
    <h2><a href="https://www.bing.com/ck/a?u=a1aHR0cHM6Ly9leGFtcGxlLmRlLw&amp;ntb=1">Example GmbH</a></h2>
    <p class="b_lineclamp2">Ein Beispiel in Heilbronn.</p>
  </li>
  <li class="b_algo">
    <h2><a href="https://www.bing.com/ck/a?u=a1aHR0cHM6Ly9leGFtcGxlLmRlLw&amp;ntb=1">Duplicate</a></h2>
    <p class="b_lineclamp2">Should be removed.</p>
  </li>
`;

describe("web result parsing", () => {
  it("reads DuckDuckGo results, decodes the redirect, and removes duplicates", () => {
    const results = parseDuckDuckGoResults(ddg);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: "IT.Works | Partner im Raum Heilbronn",
      url: "https://it.works-gmbh.de/",
      snippet: "IT.Works ist regionaler Partner für den Mittelstand.",
    });
    expect(results[1].url).toContain("northdata.de");
  });

  it("reads Bing results and decodes the a1 redirect", () => {
    expect(parseBingResults(bing)).toEqual([
      { title: "Example GmbH", url: "https://example.de/", snippet: "Ein Beispiel in Heilbronn." },
    ]);
  });

  it("turns a page into readable text without scripts, and keeps the meta description", () => {
    const page = htmlToText(`<html><head><title>IT Works</title>
      <meta name="description" content="Partner für IT">
      </head><body><script>alert("nope")</script>
      <h1>Kontakt</h1><p>Südstraße 12<br>74072 Heilbronn</p>
      <p>Mail: info@example.de</p></body></html>`);
    expect(page.title).toBe("IT Works");
    expect(page.text).toContain("Partner für IT");
    expect(page.text).toContain("Südstraße 12");
    expect(page.text).toContain("74072 Heilbronn");
    expect(page.text).toContain("info@example.de");
    expect(page.text).not.toContain("alert");
  });

  it("decodes named, decimal, and hexadecimal entities", () => {
    expect(decodeHtmlEntities("&auml;&#64;&#x20AC;&nbsp;")).toBe("ä@€ ");
  });
});

describe("web access", () => {
  it("can be turned off for both the assistant and MCP", () => {
    vi.stubEnv("MANAGR_WEB", "0");
    expect(webEnabled()).toBe(false);
    expect(findTool("web_search")).toBeUndefined();
    expect(enabledTools().some((tool) => tool.name.startsWith("web_"))).toBe(false);
    vi.stubEnv("MANAGR_WEB", "1");
    expect(webEnabled()).toBe(true);
    expect(findTool("web_search")?.name).toBe("web_search");
    expect(enabledTools().some((tool) => tool.name === "web_fetch")).toBe(true);
  });

  it("refuses to search when web access is off", async () => {
    vi.stubEnv("MANAGR_WEB", "0");
    await expect(webSearch("IT Works Heilbronn")).rejects.toThrow(/turned off/);
  });

  it("refuses loopback and non-http targets", async () => {
    vi.stubEnv("MANAGR_WEB", "1");
    await expect(webFetch("http://127.0.0.1:3000/api/views/desk")).rejects.toThrow(/private/i);
    await expect(webFetch("file:///etc/passwd")).rejects.toThrow(/http/i);
  });
});