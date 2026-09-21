# Write-up

I went with the Nager's data Countries API since it's free, needs no key, and matches what the brief suggested. though it returns the country list in ne response, i fetched it and filter by name in the client side I debounced the input at 300ms fast enough to feel responsive, but enough to cut down requests when someone's typing quickly.

The part I thought about most was making sure an old, slow response can never overwrite a newer one on screen. I handle this two ways: whenever a new search starts, I cancel the previous request with an AbortController, and I keep track of a request ID so that even if a cancelled request somehow still comes back, its result gets ignored unless it's the latest one. I added both because cancelling doesn't always stop a request instantly, a slow network can occasionally let an old response sneak through anyway.

I skipped caching repeated searches to keep this focused, but I'd look into adding it in a real app since country names don't change, that would mean skipping the network call for something already searched. The 2-letter minimum before searching is also more of a guess and would need real usage to tune properly.

I tested it by hand. I checked that typing one letter doesn't trigger a search, real country names return correctly, and nonsense input shows "no matches.
