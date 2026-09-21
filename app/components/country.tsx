"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import styles from "./style.module.css";

type Country = {
  name: string;
  code: string;
};

type Status = "idle" | "loading" | "success" | "empty" | "error";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

// Converts a 2-letter ISO country code (e.g. "NG") into its flag emoji.

function codeToFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export default function CountryTypeahead() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Country[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  const latestRequestId = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const requestId = ++latestRequestId.current;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus("loading");

    // This API returns the full country list rather than searching
    // server-side, so filtering happens client-side after the fetch.
    fetch("https://date.nager.at/api/v3/AvailableCountries", {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((data: { name: string; countryCode: string }[]) => {
        if (requestId !== latestRequestId.current) return; // stale, ignore

        const lowerQuery = trimmed.toLowerCase();
        const filtered: Country[] = data
          .filter((c) => c.name.toLowerCase().includes(lowerQuery))
          .map((c) => ({ name: c.name, code: c.countryCode }));

        setResults(filtered);
        setStatus(filtered.length === 0 ? "empty" : "success");
        setIsOpen(true);
        setHighlightedIndex(-1);
      })
      .catch((err) => {
        if (err.name === "AbortError") return; // expected on cancellation
        if (requestId !== latestRequestId.current) return; // stale, ignore

        setStatus("error");
        setResults([]);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0) selectCountry(results[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function selectCountry(country: Country) {
    setQuery(country.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  return (
    <div className={styles.wrapper}>
      <label htmlFor="country-search" className={styles.label}>
        Search for a country
      </label>

      <div className={styles.inputWrapper}>
        <input
          id="country-search"
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="country-listbox"
          aria-activedescendant={
            highlightedIndex >= 0
              ? `country-option-${highlightedIndex}`
              : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
          className={styles.input}
          value={query}
          placeholder="e.g. Nigeria"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 100)}
        />
        {status === "loading" && (
          <span className={styles.spinner} aria-hidden="true" />
        )}
      </div>

      <div className={styles.statusRegion} role="status" aria-live="polite">
        {status === "empty" && (
          <p className={styles.message}>
            No countries match &ldquo;{query}&rdquo;.
          </p>
        )}
        {status === "error" && (
          <p className={styles.messageError}>
            Something went wrong fetching results. Please try again.
          </p>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          id="country-listbox"
          role="listbox"
          ref={listboxRef}
          className={styles.listbox}
        >
          {results.map((country, index) => (
            <li
              key={country.code}
              id={`country-option-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`${styles.option} ${
                index === highlightedIndex ? styles.optionHighlighted : ""
              }`}
              onMouseDown={() => selectCountry(country)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className={styles.flag} aria-hidden="true">
                {codeToFlag(country.code)}
              </span>
              <span>{country.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
