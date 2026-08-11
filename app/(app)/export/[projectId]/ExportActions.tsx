"use client";

import { useState } from "react";
import { SegmentedControl } from "@/app/components/SegmentedControl";
import { DownloadIcon } from "@/app/components/icons";
import { buttonPrimary, fieldLabel } from "@/app/components/ui";

type Format = "pdf" | "csv" | "json";

/** Generation is a real fetch + blob download (not a plain <a>) so the button can show a genuine pending state — the design handoff calls this out explicitly since the static mock can't show it. */
export function ExportActions({ downloadUrl, filenameBase }: { downloadUrl: string; filenameBase: string }) {
  const [format, setFormat] = useState<Format>("pdf");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${downloadUrl}&format=${format}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not generate the export");
      }
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${filenameBase}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the export");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <span className={fieldLabel}>Format</span>
      <SegmentedControl
        options={[
          { value: "pdf", label: "PDF" },
          { value: "csv", label: "CSV" },
          { value: "json", label: "JSON" },
        ]}
        value={format}
        onChange={setFormat}
      />
      <button type="button" disabled={pending} onClick={generate} className={`${buttonPrimary} mt-[22px] w-full`}>
        <DownloadIcon className="h-[15px] w-[15px]" />
        {pending ? "Generating…" : "Generate export"}
      </button>
      {error && <p className="m-0 mt-2 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
