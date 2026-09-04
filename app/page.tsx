"use client";

import { useEffect, useRef } from "react";
import { focusMarkup } from "@/lib/focus-markup";
import { mountFocus } from "@/lib/focus-engine";

export default function FocusPage() {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!surface.current) return;
    return mountFocus(surface.current);
  }, []);
  return <div ref={surface} dangerouslySetInnerHTML={{ __html: focusMarkup }} />;
}
