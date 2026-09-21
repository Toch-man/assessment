"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import styles from "./style.module.css";

type Country = {
  name: string;
  code: string;
  region: string;
  flag: string;
};

type Status = "idle" | "loading" | "success" | "empty" | "error";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

export default function CountryTypeahead() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Country[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  // Guards against out-of-order responses: if request #2 fires after
  // request #1 but resolves first, request #1's response should never
  // be allowed to overwrite it. We track the "latest requested" id and
  // only commit a response to state if it still matches when it lands.
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

    // Cancel any in-flight request before starting a new one — this is
    // the primary defense against stale responses. The requestId check
    // below is the backup, in case the network layer doesn't honor the
    // abort in time (some browsers/proxies still let an aborted request
    // resolve before the cancellation is fully processed).
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus("loading");

    fetch(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(trimmed)}?fields=name,cca2,region,flag`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) {
          // The API returns 404 for "no matches" rather than an empty array
          if (res.status === 404) return [];
          throw new Error(`Request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((data: any[]) => {
        if (requestId !== latestRequestId.current) return; // stale, ignore

        const mapped: Country[] = data.map((c) => ({
          name: c.name.common,
          code: c.cca2,
          region: c.region,
          flag: c.flag,
        }));

        setResults(mapped);
        setStatus(mapped.length === 0 ? "empty" : "success");
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
                {country.flag}
              </span>
              <span>{country.name}</span>
              <span className={styles.region}>{country.region}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
